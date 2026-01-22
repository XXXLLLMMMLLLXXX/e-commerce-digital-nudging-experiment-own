// ====== КОНФИГУРАЦИЯ ======
const CONFIG = {
  GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfycbwNcL_TL8Tic4ZH1HpBQylUmN_vx_Wg-OCzdCS32kl7z42X_NWYdsQ0_lGuHG3KLyc2/exec',
  THANK_YOU_URL: 'thank-you.html',
  DEBUG: true
};

// ====== СОСТОЯНИЕ ======
const surveyState = {
  experimentData: null,
  condition: null,
  formStartTs: Date.now(),
  totalQuestions: 0,
  answeredQuestions: 0,
  interactionEvents: []
};

// ====== ЛОГИРОВАНИЕ ======
function log(message, data = null) {
  if (CONFIG.DEBUG) {
    console.log(`[SURVEY] ${message}`, data || '');
  }
}

function logInteraction(type, questionId, value) {
  surveyState.interactionEvents.push({
    type,
    questionId,
    value,
    timestamp: Date.now(),
    timeFromStart: Date.now() - surveyState.formStartTs
  });
}

// ====== ПОЛУЧЕНИЕ ДАННЫХ ИЗ МАГАЗИНА ======
function loadExperimentData() {
  log('========== ЗАГРУЗКА ДАННЫХ ЭКСПЕРИМЕНТА ==========');
  try {
    const stored = sessionStorage.getItem('experimentData');
    
    if (stored) {
      surveyState.experimentData = JSON.parse(stored);
      surveyState.condition = surveyState.experimentData.condition;
      log('✓ Данные загружены из sessionStorage');
      log('  - participantId:', surveyState.experimentData.participantId);
      log('  - condition:', surveyState.condition);
      log('  - timeOnSiteMs:', surveyState.experimentData.timeOnSiteMs);
      return true;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const conditionFromURL = urlParams.get('condition') || urlParams.get('group') || urlParams.get('groupId');
    
    if (conditionFromURL) {
      surveyState.condition = parseInt(conditionFromURL);
      surveyState.experimentData = {
        participantId: 'DIRECT_ACCESS_' + Date.now(),
        condition: surveyState.condition,
        startTs: Date.now(),
        endTs: Date.now(),
        timeOnSiteMs: 0,
        cart: {},
        cartTotal: 0,
        events: []
      };
      log('⚠️ Данные загружены из URL параметров (прямой доступ)');
      log('  - condition:', surveyState.condition);
      return true;
    }
    
    log('⚠️ ВНИМАНИЕ: Данные эксперимента не найдены!');
    log('⚠️ Использую группу 1 (control) по умолчанию');
    surveyState.condition = 1;
    surveyState.experimentData = {
      participantId: 'FALLBACK_' + Date.now(),
      condition: 1,
      startTs: Date.now(),
      endTs: Date.now(),
      timeOnSiteMs: 0,
      cart: {},
      cartTotal: 0,
      events: []
    };
    log('  - participantId:', surveyState.experimentData.participantId);
    return false;
    
  } catch (error) {
    console.error('❌ ОШИБКА при загрузке данных эксперимента:', error);
    surveyState.condition = 1;
    surveyState.experimentData = {
      participantId: 'ERROR_' + Date.now(),
      condition: 1,
      startTs: Date.now(),
      endTs: Date.now(),
      timeOnSiteMs: 0,
      cart: {},
      cartTotal: 0,
      events: []
    };
    return false;
  } finally {
    log('========== ЗАГРУЗКА ЗАВЕРШЕНА ==========');
  }
}

// ====== ПОДСЧЁТ ВОПРОСОВ ======
function countTotalQuestions() {
  const visibleRequired = document.querySelectorAll('.question-block input[required], .question-block select[required]');
  const uniqueNames = new Set();
  visibleRequired.forEach(input => {
    if (input.name) uniqueNames.add(input.name);
  });
  surveyState.totalQuestions = uniqueNames.size;
  log('Total questions:', surveyState.totalQuestions);
}

// ====== PROGRESS BAR ======
function updateProgressBar() {
  const form = document.getElementById('surveyForm');
  if (!form) return;
  
  const allQuestions = new Set();
  const answeredQuestions = new Set();
  
  const radioGroupsAll = {};
  form.querySelectorAll('input[type="radio"]').forEach(radio => {
    if (!radioGroupsAll[radio.name]) {
      radioGroupsAll[radio.name] = { radios: [], hasRequired: false };
    }
    radioGroupsAll[radio.name].radios.push(radio);
    if (radio.hasAttribute('required')) {
      radioGroupsAll[radio.name].hasRequired = true;
    }
  });
  
  Object.entries(radioGroupsAll).forEach(([name, group]) => {
    if (group.hasRequired) {
      allQuestions.add(name);
      const isAnswered = group.radios.some(r => r.checked);
      if (isAnswered) answeredQuestions.add(name);
    }
  });
  
  form.querySelectorAll('select[required]').forEach(select => {
    allQuestions.add(select.name);
    if (select.value) answeredQuestions.add(select.name);
  });
  
  const alterInput = document.getElementById('q18_age');
  const keineAngabe = document.getElementById('q18_keine_angabe');
  if (alterInput) {
    allQuestions.add('q18_age');
    if (alterInput.value || (keineAngabe && keineAngabe.checked)) {
      answeredQuestions.add('q18_age');
    }
  }
  
  surveyState.totalQuestions = allQuestions.size;
  surveyState.answeredQuestions = answeredQuestions.size;
  
  const progress = surveyState.totalQuestions > 0 
    ? (surveyState.answeredQuestions / surveyState.totalQuestions) * 100 
    : 0;
  
  const progressFill = document.getElementById('progressFill');
  if (progressFill) progressFill.style.width = `${progress}%`;
  
  log(`Progress: ${surveyState.answeredQuestions}/${surveyState.totalQuestions} (${progress.toFixed(0)}%)`);
}

// ====== ВАЛИДАЦИЯ ======
function validateForm() {
  log('========== ВАЛИДАЦИЯ ФОРМЫ ==========');
  let isValid = true;
  const form = document.getElementById('surveyForm');
  
  document.querySelectorAll('.error-message').forEach(err => err.classList.remove('show'));
  
  const radioGroupsAll = {};
  form.querySelectorAll('input[type="radio"]').forEach(radio => {
    const block = radio.closest('.question-block');
    if (block) {
      if (!radioGroupsAll[radio.name]) {
        radioGroupsAll[radio.name] = { radios: [], hasRequired: false, block: block };
      }
      radioGroupsAll[radio.name].radios.push(radio);
      if (radio.hasAttribute('required')) {
        radioGroupsAll[radio.name].hasRequired = true;
      }
    }
  });
  
  log(`Найдено ${Object.keys(radioGroupsAll).length} radio групп`);
  
  Object.entries(radioGroupsAll).forEach(([name, group]) => {
    if (group.hasRequired) {
      const isAnswered = group.radios.some(r => r.checked);
      log(`Проверка ${name}: ${isAnswered ? '✓ ОТВЕТ ЕСТЬ' : '✗ НЕТ ОТВЕТА'}`);
      
      if (!isAnswered) {
        isValid = false;
        const errorMsg = group.block.querySelector('.error-message');
        if (errorMsg) {
          errorMsg.classList.add('show');
          log(`❌ ОШИБКА: ${name} не отвечен`);
        }
      }
    }
  });
  
  let selectCount = 0;
  form.querySelectorAll('select').forEach(select => {
    const block = select.closest('.question-block');
    if (block && select.hasAttribute('required')) {
      selectCount++;
      log(`Проверка ${select.name}: ${select.value ? '✓ ВЫБРАНО' : '✗ НЕ ВЫБРАНО'}`);
      if (!select.value) {
        isValid = false;
        const errorMsg = block.querySelector('.error-message');
        if (errorMsg) {
          errorMsg.classList.add('show');
          log(`❌ ОШИБКА: ${select.name} не выбран`);
        }
      }
    }
  });
  log(`Найдено ${selectCount} select полей для проверки`);
  
  const alterInput = document.getElementById('q18_age');
  const keineAngabe = document.getElementById('q18_keine_angabe');
  if (alterInput) {
    const block = alterInput.closest('.question-block');
    if (block) {
      const hasAge = alterInput.value && alterInput.value.trim() !== '';
      const hasCheckbox = keineAngabe && keineAngabe.checked;
      log(`Проверка возраста: значение="${alterInput.value}", checkbox=${hasCheckbox}, valid=${hasAge || hasCheckbox ? 'ДА' : 'НЕТ'}`);
      if (!hasAge && !hasCheckbox) {
        isValid = false;
        const errorMsg = document.getElementById('q18_error');
        if (errorMsg) {
          errorMsg.classList.add('show');
          log('❌ ОШИБКА: возраст не указан');
        }
      }
    }
  }
  
  if (isValid) {
    log('✅ ========== ВАЛИДАЦИЯ ПРОЙДЕНА ==========');
  } else {
    log('❌ ========== ВАЛИДАЦИЯ ПРОВАЛЕНА ==========');
    const firstError = document.querySelector('.error-message.show');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  return isValid;
}

// ====== СБОР ДАННЫХ ФОРМЫ ======
function collectFormData() {
  const form = document.getElementById('surveyForm');
  const formData = {};
  
  const radioGroups = {};
  form.querySelectorAll('input[type="radio"]').forEach(radio => {
    if (!radioGroups[radio.name]) {
      radioGroups[radio.name] = radio.checked ? radio.value : null;
    } else if (radio.checked) {
      radioGroups[radio.name] = radio.value;
    }
  });
  Object.assign(formData, radioGroups);
  
  form.querySelectorAll('select').forEach(select => {
    formData[select.name] = select.value;
  });
  
  const alterInput = document.getElementById('q18_age');
  const keineAngabe = document.getElementById('q18_keine_angabe');
  if (alterInput) {
    if (keineAngabe && keineAngabe.checked) {
      formData.q18_age = 'Keine Angabe';
    } else {
      formData.q18_age = alterInput.value;
    }
  }
  
  log('Form data collected:', formData);
  return formData;
}

// ====== ОТПРАВКА В GOOGLE SHEETS ======
async function sendToGoogleSheets(data) {
  log('📤 Отправка данных в Google Sheets...');
  log('URL:', CONFIG.GOOGLE_SHEETS_URL);
  
  try {
    const response = await fetch(CONFIG.GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    log('✅ Данные успешно отправлены в Google Sheets');
    return { success: true, message: 'Data sent successfully' };
    
  } catch (error) {
    console.error('❌ ОШИБКА отправки в Google Sheets:', error);
    localStorage.setItem('surveyData_failed_' + Date.now(), JSON.stringify(data));
    log('💾 Данные сохранены локально из-за ошибки');
    return { success: false, error: error.message };
  }
}

// ====== ПОДГОТОВКА ФИНАЛЬНЫХ ДАННЫХ ======
function prepareFinalData(formData) {
  const experimentData = surveyState.experimentData;
  
  const cartItems = [];
  let cartTotal = 0;
  
  if (experimentData.cart) {
    Object.entries(experimentData.cart).forEach(([productId, qty]) => {
      if (qty > 0) cartItems.push(`${productId}:${qty}`);
    });
  }
  
  if (experimentData.cartTotal) {
    cartTotal = experimentData.cartTotal;
  }
  
  const finalData = {
    timestamp: new Date().toISOString(),
    submissionTime: new Date().toLocaleString('de-DE'),
    participantId: experimentData.participantId || 'UNKNOWN',
    prolificPID: experimentData.prolificPID || sessionStorage.getItem('prolificPID') || 'N/A',
    studyID: experimentData.studyID || sessionStorage.getItem('studyID') || 'N/A',
    sessionID: experimentData.sessionID || sessionStorage.getItem('sessionID') || 'N/A',
    experimentCondition: experimentData.condition,
    experimentGroupName: ['control', 'socialproof', 'scarcity', 'both'][experimentData.condition - 1] || 'unknown',
    timeOnSiteSeconds: Math.round(experimentData.timeOnSiteMs / 1000),
    cartProducts: cartItems.join(',') || 'empty',
    cartTotal: cartTotal.toFixed(2),
    surveyDurationSeconds: Math.round((Date.now() - surveyState.formStartTs) / 1000),
    
    // Q01-Q08: Produktbewertung
    q01_attractiveness: formData.q01_attractiveness,
    q02_quality: formData.q02_quality,
    q03_purchaseIntention: formData.q03_purchase_intention,
    q04_canImagine: formData.q04_can_imagine,
    q05_relevance: formData.q05_relevance,
    q06_involvement: formData.q06_involvement,
    q07_interest: formData.q07_interest,
    q08_pricePerception: formData.q08_price_perception,
    
    // Q09-Q11: Wahrgenommene Beliebtheit (Медиатор)
    q09_popularity1: formData.q09_popularity_1,
    q10_popularity2: formData.q10_popularity_2,
    q11_popularity3: formData.q11_popularity_3,
    
    // Q12-Q14: Wahrgenommene Dringlichkeit (Медиатор)
    q12_urgency1: formData.q12_urgency_1,
    q13_urgency2: formData.q13_urgency_2,
    q14_urgency3: formData.q14_urgency_3,
    
    // Q15-Q16: Manipulation Checks
    q15_socialProofCheck: formData.q15_sp_check,
    q16_scarcityCheck: formData.q16_sc_check,
    
    // Q17: Attention Check
    q17_attentionCheck: formData.q17_attention,
    
    // Q18-Q21: Демография
    q18_age: formData.q18_age,
    q19_gender: formData.q19_gender,
    q20_education: formData.q20_education,
    q21_proteinFrequency: formData.q21_protein_frequency,
    
    interactionEvents: JSON.stringify(surveyState.interactionEvents),
    experimentEvents: JSON.stringify(experimentData.events || [])
  };
  
  log('Final data prepared:', finalData);
  return finalData;
}

// ====== ОБРАБОТКА ОТПРАВКИ ФОРМЫ ======
async function handleSubmit(event) {
  event.preventDefault();
  log('Form submit triggered');
  
  if (!validateForm()) {
    log('Form validation failed, stopping submission');
    return;
  }
  
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet...';
  }
  
  try {
    const formData = collectFormData();
    const finalData = prepareFinalData(formData);
    const result = await sendToGoogleSheets(finalData);
    
    if (result.success) {
      log('Submission successful! Redirecting to thank you page...');
      sessionStorage.setItem('surveyCompleted', 'true');
      window.location.href = CONFIG.THANK_YOU_URL;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('[SURVEY ERROR] Submission error:', error);
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Umfrage absenden';
    }
    
    alert('Es gab einen Fehler beim Absenden der Umfrage. Bitte versuchen Sie es erneut oder kontaktieren Sie den Administrator.');
  }
}

// ====== ОБРАБОТЧИКИ СОБЫТИЙ ======
function setupEventListeners() {
  const form = document.getElementById('surveyForm');
  if (!form) return;
  
  form.addEventListener('submit', handleSubmit);
  
  form.addEventListener('change', (e) => {
    updateProgressBar();
    if (e.target.name) {
      logInteraction('change', e.target.name, e.target.value);
    }
  });
  
  const keineAngabe = document.getElementById('q18_keine_angabe');
  const alterInput = document.getElementById('q18_age');
  
  if (keineAngabe && alterInput) {
    keineAngabe.addEventListener('change', () => {
      if (keineAngabe.checked) {
        alterInput.value = '';
        alterInput.disabled = true;
        logInteraction('checkbox', 'q18_keine_angabe', 'checked');
      } else {
        alterInput.disabled = false;
      }
      updateProgressBar();
    });
    
    alterInput.addEventListener('input', () => {
      if (alterInput.value) {
        keineAngabe.checked = false;
      }
    });
  }
  
  document.querySelectorAll('.radio-option').forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.addEventListener('change', () => {
        const group = document.querySelectorAll(`input[name="${radio.name}"]`);
        group.forEach(r => {
          r.closest('.radio-option').classList.remove('selected');
        });
        if (radio.checked) {
          option.classList.add('selected');
        }
      });
    }
  });
  
  log('Event listeners setup complete');
}

// ====== ИНИЦИАЛИЗАЦИЯ ======
function init() {
  log('=== SURVEY INITIALIZATION ===');
  log('Current time:', new Date().toLocaleString());
  
  const dataLoaded = loadExperimentData();
  if (!dataLoaded) {
    console.warn('⚠️ Experiment data not found or incomplete');
  }
  
  countTotalQuestions();
  setupEventListeners();
  updateProgressBar();
  logInteraction('survey_start', 'init', surveyState.condition);
  
  log('=== INITIALIZATION COMPLETE ===');
  log('Condition:', surveyState.condition);
  log('Total questions:', surveyState.totalQuestions);
}

// ====== ЗАПУСК ======
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ====== СОХРАНЕНИЕ ДАННЫХ ПРИ ЗАКРЫТИИ ======
window.addEventListener('beforeunload', () => {
  logInteraction('page_unload', 'survey', 'incomplete');
  log('Survey page unloading. Duration:', (Date.now() - surveyState.formStartTs) / 1000, 'seconds');
});


