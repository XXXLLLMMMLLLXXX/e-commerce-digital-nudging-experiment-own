// ====== КОНФИГУРАЦИЯ ======
const CONFIG = {
  // URL вашего Google Apps Script Web App
  GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/AKfycbylAjyhtWSg-Y_U202Dpqt_DRMfJxIG9gHvzb_N-kZSazvPqo5YedeUj7uJRaesaQgT/exec',
  
  // Альтернативный URL thank-you страницы
  THANK_YOU_URL: 'thank-you.html',
  
  // Включить debug режим (логи в консоль)
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

// ====== ПОКАЗАТЬ/СКРЫТЬ УСЛОВНЫЕ ВОПРОСЫ ======
function setupConditionalQuestions() {
  const condition = surveyState.condition;
  log('========== НАСТРОЙКА УСЛОВНЫХ ВОПРОСОВ ==========');
  log('Группа участника:', condition);
  
  const urgencyBlock = document.getElementById('qnew2_block');
  if (urgencyBlock) {
    if (condition === 3 || condition === 4) {
      urgencyBlock.classList.remove('hidden');
      const inputs = urgencyBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => inp.setAttribute('required', 'required'));
      log('✓ NEW_Q2 (Urgency) ПОКАЗАН');
    } else {
      urgencyBlock.classList.add('hidden');
      const inputs = urgencyBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => {
        inp.removeAttribute('required');
        inp.checked = false;
      });
      log('✗ NEW_Q2 (Urgency) СКРЫТ');
    }
  }
  
  const trustBlock = document.getElementById('qnew3_block');
  if (trustBlock) {
    if (condition === 2 || condition === 4) {
      trustBlock.classList.remove('hidden');
      const inputs = trustBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => inp.setAttribute('required', 'required'));
      log('✓ NEW_Q3 (Trust) ПОКАЗАН');
    } else {
      trustBlock.classList.add('hidden');
      const inputs = trustBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => {
        inp.removeAttribute('required');
        inp.checked = false;
      });
      log('✗ NEW_Q3 (Trust) СКРЫТ');
    }
  }
  
  const beliebtBlock = document.getElementById('q03_block');
  if (beliebtBlock) {
    if (condition === 2 || condition === 4) {
      beliebtBlock.classList.remove('hidden');
      const inputs = beliebtBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => inp.setAttribute('required', 'required'));
      log('✓ Q03 (Beliebtheit) ПОКАЗАН');
    } else {
      beliebtBlock.classList.add('hidden');
      const inputs = beliebtBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => {
        inp.removeAttribute('required');
        inp.checked = false;
      });
      log('✗ Q03 (Beliebtheit) СКРЫТ');
    }
  }
  
  const knappBlock = document.getElementById('q04_block');
  if (knappBlock) {
    if (condition === 3 || condition === 4) {
      knappBlock.classList.remove('hidden');
      const inputs = knappBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => inp.setAttribute('required', 'required'));
      log('✓ Q04 (Knappheit) ПОКАЗАН');
    } else {
      knappBlock.classList.add('hidden');
      const inputs = knappBlock.querySelectorAll('input[type="radio"]');
      inputs.forEach(inp => {
        inp.removeAttribute('required');
        inp.checked = false;
      });
      log('✗ Q04 (Knappheit) СКРЫТ');
    }
  }
  
  log('========== УСЛОВНЫЕ ВОПРОСЫ НАСТРОЕНЫ ==========');
  countTotalQuestions();
}

// ====== ПОДСЧЁТ ВОПРОСОВ ======
function countTotalQuestions() {
  const visibleRequired = document.querySelectorAll('.question-block:not(.hidden) input[required], .question-block:not(.hidden) select[required]');
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
    const block = radio.closest('.question-block');
    if (block && !block.classList.contains('hidden')) {
      if (!radioGroupsAll[radio.name]) {
        radioGroupsAll[radio.name] = { radios: [], hasRequired: false };
      }
      radioGroupsAll[radio.name].radios.push(radio);
      if (radio.hasAttribute('required')) {
        radioGroupsAll[radio.name].hasRequired = true;
      }
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
    if (!select.closest('.question-block').classList.contains('hidden')) {
      allQuestions.add(select.name);
      if (select.value) answeredQuestions.add(select.name);
    }
  });
  
  const alterInput = document.getElementById('q16_alter');
  const keineAngabe = document.getElementById('q16_keine_angabe');
  if (alterInput && !alterInput.closest('.question-block').classList.contains('hidden')) {
    allQuestions.add('q16_alter');
    if (alterInput.value || (keineAngabe && keineAngabe.checked)) {
      answeredQuestions.add('q16_alter');
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
    if (block && !block.classList.contains('hidden')) {
      if (!radioGroupsAll[radio.name]) {
        radioGroupsAll[radio.name] = { radios: [], hasRequired: false, block: block };
      }
      radioGroupsAll[radio.name].radios.push(radio);
      if (radio.hasAttribute('required')) {
        radioGroupsAll[radio.name].hasRequired = true;
      }
    }
  });
  
  log(`Найдено ${Object.keys(radioGroupsAll).length} видимых radio групп`);
  
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
    if (block && !block.classList.contains('hidden') && select.hasAttribute('required')) {
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
  log(`Найдено ${selectCount} видимых select полей для проверки`);
  
  const alterInput = document.getElementById('q16_alter');
  const keineAngabe = document.getElementById('q16_keine_angabe');
  if (alterInput) {
    const block = alterInput.closest('.question-block');
    if (block && !block.classList.contains('hidden')) {
      const hasAge = alterInput.value && alterInput.value.trim() !== '';
      const hasCheckbox = keineAngabe && keineAngabe.checked;
      log(`Проверка возраста: значение="${alterInput.value}", checkbox=${hasCheckbox}, valid=${hasAge || hasCheckbox ? 'ДА' : 'НЕТ'}`);
      if (!hasAge && !hasCheckbox) {
        isValid = false;
        const errorMsg = document.getElementById('q16_error');
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
  
  const alterInput = document.getElementById('q16_alter');
  const keineAngabe = document.getElementById('q16_keine_angabe');
  if (alterInput) {
    if (keineAngabe && keineAngabe.checked) {
      formData.q16_alter = 'Keine Angabe';
    } else {
      formData.q16_alter = alterInput.value;
    }
  }
  
  log('Form data collected:', formData);
  return formData;
}

// ====== ОТПРАВКА В GOOGLE SHEETS (ИСПРАВЛЕНО!) ======
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
  
  // ⭐ ДОБАВЛЕНЫ 3 СТРОКИ ДЛЯ PROLIFIC ⭐
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
    q06_attractiveness: formData.q06_attraktiv,
    q07_quality: formData.q07_hochwertig,
    q05_purchaseIntention: formData.q05_kaufwahrsch,
    q11_canImagine: formData.q11_vorstellen,
    q08_relevance: formData.q08_relevant,
    q09_involvement: formData.q09_beschaeftigt,
    q10_interest: formData.q10_interesse,
    qnew1_pricePerception: formData.qnew1_preis,
    qnew2_urgency: formData.qnew2_urgency || 'N/A',
    qnew3_trust: formData.qnew3_trust || 'N/A',
    q03_popularity: formData.q03_beliebt || 'N/A',
    q04_scarcity: formData.q04_knapp || 'N/A',
    q13_socialProofCheck: formData.q13_sp_check,
    q14_scarcityCheck: formData.q14_sc_check,
    q15_attentionCheck: formData.q15_attention,
    q16_age: formData.q16_alter,
    q17_gender: formData.q17_geschlecht,
    q18_education: formData.q18_bildung,
    q19_proteinFrequency: formData.q19_protein,
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
  
  const keineAngabe = document.getElementById('q16_keine_angabe');
  const alterInput = document.getElementById('q16_alter');
  
  if (keineAngabe && alterInput) {
    keineAngabe.addEventListener('change', () => {
      if (keineAngabe.checked) {
        alterInput.value = '';
        alterInput.disabled = true;
        logInteraction('checkbox', 'q16_keine_angabe', 'checked');
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
  
  setupConditionalQuestions();
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

