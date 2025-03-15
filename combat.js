// Глобальные переменные
let currentTurnIndex = 0;
let roundCounter = 0;
const battlefieldSize = 1000; // Фиксированный размер в пикселях (1000x1000px)
const baseScale = 8.33; // Масштаб: 1 клетка = 5 футов, 1 фут = ~8.33px
const gridSize = 50; // Размер клетки сетки

let zoomLevel = 1.0;
const zoomMin = 0.3; // Уменьшаем минимальный зум для более широкого обзора
const zoomMax = 2.0;
let translateX = 0;
let translateY = 0;
let isDraggingMap = false;
let startDragX, startDragY;
let isDrawingWall = false;
let wallStartX, wallStartY;

// Добавляем историю стен для Ctrl+Z
let wallHistory = [];
let isCtrlPressed = false;

let showFeetDistance = true; // Добавляем переменную для отслеживания состояния

// Добавляем список доступных состояний
const CONDITIONS = {
    invisible: { name: 'Невидимость', icon: 'fa-eye-slash' },
    rage: { name: 'Ярость', icon: 'fa-fire' },
    paralyzed: { name: 'Паралич', icon: 'fa-bolt' },
    poisoned: { name: 'Отравление', icon: 'fa-skull-crossbones' },
    blessed: { name: 'Благословение', icon: 'fa-pray' },
    cursed: { name: 'Проклятие', icon: 'fa-hand-holding-magic' },
    charmed: { name: 'Очарование', icon: 'fa-heart' },
    stunned: { name: 'Оглушение', icon: 'fa-dizzy' }
};

// Функция для создания модального окна состояний
function createConditionsModal() {
    const modal = document.createElement('div');
    modal.classList.add('conditions-modal');
    modal.innerHTML = `
        <h3>Состояния</h3>
        <div class="conditions-list">
            ${Object.entries(CONDITIONS).map(([key, condition]) => `
                <div class="condition-item" data-condition="${key}">
                    <i class="fas ${condition.icon}"></i>
                    ${condition.name}
                </div>
            `).join('')}
        </div>
        <div class="modal-buttons">
            <button onclick="closeConditionsModal()">Закрыть</button>
        </div>
    `;
    
    const overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    
    return { modal, overlay };
}

let currentCharacter = null;
let conditionsModal = null;

function showConditionsModal(char) {
    if (!conditionsModal) {
        conditionsModal = createConditionsModal();
    }
    
    currentCharacter = char;
    conditionsModal.modal.style.display = 'block';
    conditionsModal.overlay.style.display = 'block';
    
    // Подсвечиваем активные состояния
    const activeConditions = char.dataset.conditions ? JSON.parse(char.dataset.conditions) : [];
    document.querySelectorAll('.condition-item').forEach(item => {
        item.classList.toggle('active', activeConditions.includes(item.dataset.condition));
    });
}

function closeConditionsModal() {
    if (conditionsModal) {
        conditionsModal.modal.style.display = 'none';
        conditionsModal.overlay.style.display = 'none';
    }
    currentCharacter = null;
}

function setupConditionsSystem() {
    // Создаем модальное окно при загрузке
    conditionsModal = createConditionsModal();

    // Обработчик клика по состоянию
    document.querySelectorAll('.condition-item').forEach(item => {
        item.addEventListener('click', () => {
            if (!currentCharacter) return;
            
            const condition = item.dataset.condition;
            let conditions = currentCharacter.dataset.conditions ? JSON.parse(currentCharacter.dataset.conditions) : [];
            
            if (conditions.includes(condition)) {
                conditions = conditions.filter(c => c !== condition);
            } else {
                conditions.push(condition);
            }
            
            currentCharacter.dataset.conditions = JSON.stringify(conditions);
            item.classList.toggle('active');
            updateCharacterConditions(currentCharacter);
            saveCombatData();
        });
    });
}

function updateCharacterConditions(char) {
    let container = char.querySelector('.conditions-container');
    if (!container) {
        container = document.createElement('div');
        container.classList.add('conditions-container');
        char.appendChild(container);
    }
    
    const conditions = char.dataset.conditions ? JSON.parse(char.dataset.conditions) : [];
    container.innerHTML = conditions.map(condition => `
        <span class="condition-icon">
            <i class="fas ${CONDITIONS[condition].icon}" title="${CONDITIONS[condition].name}"></i>
        </span>
    `).join('');
}

// События при загрузке документа
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация боевого поля
    initializeBattlefield();
    
    // Загрузка сохраненных данных
    loadCombatData();
    
    // Обновление счетчика раундов
    updateRoundCounter();
    
    // Инициализация событий для элементов на странице
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control') {
            isCtrlPressed = true;
        } else if (isCtrlPressed && e.key === 'z') {
            e.preventDefault(); // Предотвращаем стандартное поведение браузера
            undoLastWall();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control') {
            isCtrlPressed = false;
        }
    });
    
    // Другие обработчики событий для страницы, которые нужно добавить
}

function undoLastWall() {
    if (wallHistory.length > 0) {
        const lastWall = wallHistory.pop();
        lastWall.line.remove();
        lastWall.startPoint.remove();
        lastWall.endPoint.remove();
        saveCombatData();
    }
}

// Функция для воспроизведения звука
function playSound(soundFile) {
    const audio = new Audio(`sounds/${soundFile}`);
    audio.play().catch(error => console.log("Ошибка воспроизведения звука:", error));
}

// Переключение режима рисования
function toggleDrawMode() {
    isDrawingWall = !isDrawingWall;
    const button = document.getElementById('draw-mode-toggle');
    button.classList.toggle('active', isDrawingWall);
    if (isDrawingWall) {
        battlefieldContainer.style.cursor = 'crosshair';
    } else {
        battlefieldContainer.style.cursor = 'grab';
        wallStartX = null;
        wallStartY = null;
        const tempLine = document.querySelector('.temp-wall');
        if (tempLine) tempLine.remove();
    }
}

// Функция для совместимости с HTML - переключает отображение расстояния в футах
function toggleGridLabels() {
    toggleFeetDisplay();
}

// Переключение режима рисования для кнопки в интерфейсе
function toggleDrawingMode() {
    toggleDrawMode();
}

// Сброс позиций
function resetPositions() {
    document.querySelectorAll('.character').forEach(char => {
        char.style.left = '0px';
        char.style.top = '0px';
    });
    zoomLevel = 1.0;
    translateX = 0;
    translateY = 0;
    updateBattlefieldTransform();
    saveCombatData();
}

// Очистка стен
function clearWalls() {
    document.querySelectorAll('.wall-line, .wall-snap-point').forEach(el => el.remove());
    const tempLine = document.querySelector('.temp-wall');
    if (tempLine) tempLine.remove();
    wallHistory = []; // Очищаем историю стен
    saveCombatData();
}

function calculateExpression(currentValue, expression) {
    try {
        if (expression.startsWith('+') || expression.startsWith('-')) {
            const relativeValue = eval(expression);
            const result = currentValue + relativeValue;
            return { result, expression };
        } else {
            const result = eval(expression);
            if (typeof result === 'number' && !isNaN(result)) {
                return { result, expression };
            } else {
                return { result: expression, expression: '' };
            }
        }
    } catch (error) {
        return { result: expression, expression: '' };
    }
}

function loadParticipantList() {
    const type = document.getElementById('participant-type').value;
    let list = [];
    if (type === 'player') {
        const pcsData = JSON.parse(localStorage.getItem('pcs-table') || '[]');
        list = pcsData.map(row => row[0]);
    } else {
        const monstersData = JSON.parse(localStorage.getItem('monsters-table') || '[]');
        list = monstersData.map(row => row[0]);
    }
    const select = document.getElementById('participant-list');
    select.innerHTML = '';
    if (list.length === 0) {
        const option = document.createElement('option');
        option.innerText = 'Нет доступных участников';
        select.appendChild(option);
    } else {
        list.forEach(participant => {
            const option = document.createElement('option');
            option.value = participant;
            option.innerText = participant;
            select.appendChild(option);
        });
    }
}

function addParticipant() {
    const type = document.getElementById('participant-type').value;
    const name = document.getElementById('participant-list').value;
    const initiative = document.getElementById('initiative').value.trim() === '' ? 0 : parseInt(document.getElementById('initiative').value);
    const currentHpInput = document.getElementById('current-hp').value.trim();

    let participantData;
    if (type === 'player') {
        const pcsData = JSON.parse(localStorage.getItem('pcs-table') || '[]');
        participantData = pcsData.find(row => row[0] === name);
    } else {
        const monstersData = JSON.parse(localStorage.getItem('monsters-table') || '[]');
        participantData = monstersData.find(row => row[0] === name);
    }

    if (!participantData) return;

    const maxHp = participantData[1];
    const armorClass = participantData[2] || '0';
    const maxSteam = participantData[3] || '0';
    const currentHp = currentHpInput ? parseInt(calculateExpression(0, currentHpInput).result) : parseInt(maxHp);
    const currentSteam = maxSteam; // По умолчанию заполнен

    // Генерация уникального идентификатора для персонажа
    let uniqueId;
    const existingRows = Array.from(document.querySelectorAll('#combat-table tr')).slice(1); // Пропускаем заголовок
    
    const sameNameRows = existingRows.filter(row => {
        const nameCell = row.cells[1];
        return nameCell.innerText === name || nameCell.innerText.startsWith(name + ' (');
    });
    
    // Всегда добавляем номер, начиная с (1) для первого экземпляра
    const count = sameNameRows.length + 1;
    uniqueId = `${name} (${count})`;

    const table = document.getElementById('combat-table');
    const row = table.insertRow();
    row.classList.add('card', 'fade-in');
    row.insertCell().innerText = type === 'player' ? 'Игрок' : 'Враг';
    
    // Сохраняем уникальный идентификатор в таблице
    row.insertCell().innerText = uniqueId;
    
    row.insertCell().innerText = initiative;
    
    // HP Cell
    const hpCell = row.insertCell();
    hpCell.contentEditable = true;
    const hpProgress = (currentHp / maxHp) * 100;
    hpCell.innerHTML = `
        <div>${currentHp} / ${maxHp}</div>
        <div class="progress-bar" style="width: ${hpProgress}%;"></div>
    `;
    hpCell.dataset.currentValue = currentHp;
    hpCell.dataset.maxValue = maxHp;
    
    // AC Cell
    const acCell = row.insertCell();
    acCell.innerHTML = `
        <div class="ac-container">
            <div class="ac-circle">${armorClass}</div>
        </div>
    `;
    
    // Steam Cell
    const steamCell = row.insertCell();
    steamCell.contentEditable = true;
    const steamProgress = (currentSteam / maxSteam) * 100;
    steamCell.innerHTML = `
        <div>⚡ ${currentSteam} / ${maxSteam}</div>
        <div class="steam-bar" style="width: 100%;">
            <div class="steam-fill" style="width: ${steamProgress}%;"></div>
        </div>
    `;
    steamCell.dataset.currentValue = currentSteam;
    steamCell.dataset.maxValue = maxSteam;
    
    const historyCell = row.insertCell();
    historyCell.innerHTML = '';
    historyCell.contentEditable = false;
    
    const actionCell = row.insertCell();
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash"></i> Удалить';
    deleteButton.onclick = () => {
        playSound('delete.mp3');
        row.classList.add('fade-out');
        // Используем имя из ячейки таблицы, а не оригинальное имя из participant
        const charName = row.cells[1].innerText;
        removeCharacterFromBattlefield(charName);
        setTimeout(() => row.remove(), 300);
        saveCombatData();
    };
    actionCell.appendChild(deleteButton);

    // Используем уникальный идентификатор при добавлении на поле боя
    addCharacterToBattlefield(uniqueId, type);

    hpCell.addEventListener('keypress', handleHpInput);
    steamCell.addEventListener('keypress', handleSteamInput);
    sortTable();
    saveCombatData();
}

// Обработка ввода паровых зарядов
function handleSteamInput(event) {
    if (event.key === 'Enter') {
        const cell = event.target;
        const currentValue = parseFloat(cell.dataset.currentValue) || 0;
        const text = cell.textContent.trim().split('/')[0].trim().replace('⚡', '').trim();
        const { result } = calculateExpression(currentValue, text);
        const maxValue = cell.dataset.maxValue;
        const progress = (result / maxValue) * 100;
        cell.innerHTML = `
            <div>⚡ ${result} / ${maxValue}</div>
            <div class="steam-bar" style="width: 100%;">
                <div class="steam-fill" style="width: ${progress}%;"></div>
            </div>
        `;
        cell.dataset.currentValue = result;

        const row = cell.parentElement;
        const historyCell = row.cells[6];
        let historyEntry = `⚡: ${text}`;
        const currentHistory = historyCell.innerText ? historyCell.innerText + ', ' : '';
        historyCell.innerHTML = `<span class="hp-expression">${currentHistory}${historyEntry}</span>`;

        // Обновляем паровые заряды на поле боя
        const name = row.cells[1].innerText;
        const char = document.querySelector(`.character[data-name="${name}"]`);
        if (char) {
            const steamDisplay = char.querySelector('.steam-display');
            const steamFill = char.querySelector('.steam-fill');
            if (steamDisplay && steamFill) {
                steamDisplay.innerText = `⚡ ${result}/${maxValue}`;
                steamFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            }
        }

        cell.blur();
        saveCombatData();
        event.preventDefault();
    }
}

function handleHpInput(event) {
    if (event.key === 'Enter') {
        const cell = event.target;
        const currentValue = parseFloat(cell.dataset.currentValue) || 0;
        const text = cell.textContent.trim().split('/')[0].trim();
        const { result, expression } = calculateExpression(currentValue, text);
        const maxValue = cell.dataset.maxValue;
        const progress = (result / maxValue) * 100;
        cell.innerHTML = `
            <div>${result} / ${maxValue}</div>
            <div class="progress-bar" style="width: ${progress}%;"></div>
        `;
        cell.dataset.currentValue = result;

        const row = cell.parentElement;
        const historyCell = row.cells[6];
        let historyEntry = text;
        const currentHistory = historyCell.innerText ? historyCell.innerText + ', ' : '';
        historyCell.innerHTML = `<span class="hp-expression">${currentHistory}${historyEntry}</span>`;

        // Обновляем HP на поле боя
        const name = row.cells[1].innerText;
        const char = document.querySelector(`.character[data-name="${name}"]`);
        if (char) {
            const hpDisplay = char.querySelector('.hp-display');
            const hpFill = char.querySelector('.hp-fill');
            if (hpDisplay && hpFill) {
                hpDisplay.innerText = `${result}/${maxValue}`;
                hpFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            }
        }

        cell.blur();
        saveCombatData();
        event.preventDefault();
    }
}

function sortTable() {
    const table = document.getElementById('combat-table');
    let rows = Array.from(table.rows).slice(1);
    rows.sort((a, b) => parseInt(b.cells[2].innerText) - parseInt(a.cells[2].innerText));
    while (table.rows.length > 1) table.deleteRow(1);
    rows.forEach(row => table.appendChild(row));
    highlightCurrentTurn();
}

function highlightCurrentTurn() {
    const table = document.getElementById('combat-table');
    // Сначала удаляем класс current-player у всех персонажей
    document.querySelectorAll('.character').forEach(char => {
        char.classList.remove('current-player');
    });

    for (let i = 1; i < table.rows.length; i++) {
        table.rows[i].classList.remove('current-turn');
        if (i - 1 === currentTurnIndex) {
            table.rows[i].classList.add('current-turn');
            const name = table.rows[i].cells[1].innerText;
            
            // Ищем персонажа по точному совпадению имени (включая номер в скобках)
            const character = document.querySelector(`.character[data-name="${name}"]`);
            if (character) {
                character.classList.add('current-player');
                console.log(`Добавлен класс current-player для персонажа: ${character.dataset.name}, тип: ${character.classList.contains('enemy') ? 'враг' : 'игрок'}`);
            }
        }
    }
}

function nextTurn() {
    const table = document.getElementById('combat-table');
    if (table.rows.length > 1) {
        currentTurnIndex = (currentTurnIndex + 1) % (table.rows.length - 1);
        if (currentTurnIndex === 0) {
            roundCounter++;
            updateRoundCounter();
        }
        highlightCurrentTurn();
        saveCombatData();
    }
}

function clearAll() {
    const table = document.getElementById('combat-table');
    while (table.rows.length > 1) table.deleteRow(1);
    document.getElementById('battlefield').innerHTML = '';
    roundCounter = 0;
    currentTurnIndex = 0;
    zoomLevel = 1.0;
    translateX = 0;
    translateY = 0;
    updateBattlefieldTransform();
    clearWalls();
    updateRoundCounter();
    initializeGrid();
    saveCombatData();
}

function updateRoundCounter() {
    document.getElementById('round-counter').innerText = `Раунд: ${roundCounter}`;
}

function returnToCampaign() {
    saveCombatData();
    localStorage.setItem('lastSave', Date.now().toString());
    window.location.href = 'index.html';
    playSound('button-click.mp3');
}

// Функция сохранения состояния боя
function saveCombatData() {
    try {
        const table = document.getElementById('combat-table');
        const combatData = [];
        const characters = document.querySelectorAll('.character');
        
        // Собираем данные из таблицы
        for (let i = 1; i < table.rows.length; i++) {
            const row = table.rows[i];
            const name = row.cells[1].innerText;
            const category = row.cells[0].innerText;
            const initiative = row.cells[2].innerText;
            const currentHp = row.cells[3].dataset.currentValue;
            const maxHp = row.cells[3].dataset.maxValue;
            const armorClass = row.cells[4].querySelector('.ac-circle').innerText;
            const currentSteam = row.cells[5].dataset.currentValue || '0';
            const maxSteam = row.cells[5].dataset.maxValue || '0';
            const history = row.cells[6].querySelector('.hp-expression')?.innerText || '';
            
            // Найдем позицию персонажа на поле
            let position = { x: 0, y: 0 };
            characters.forEach(char => {
                if (char.dataset.name === name) {
                    position.x = parseInt(char.style.left) / baseScale;
                    position.y = parseInt(char.style.top) / baseScale;
                    
                    // Сохраняем состояния персонажа, если они есть
                    if (char.dataset.conditions) {
                        position.conditions = JSON.parse(char.dataset.conditions);
                    }
                }
            });
            
            // Добавляем данные персонажа
            combatData.push({
                name,
                category,
                initiative,
                currentHp,
                maxHp,
                armorClass,
                currentSteam,
                maxSteam,
                history,
                position
            });
        }
        
        // Собираем данные о стенах
        const walls = wallHistory.map(wall => {
            return {
                x1: parseInt(wall.startPoint.dataset.x) / baseScale,
                y1: parseInt(wall.startPoint.dataset.y) / baseScale,
                x2: parseInt(wall.endPoint.dataset.x) / baseScale,
                y2: parseInt(wall.endPoint.dataset.y) / baseScale
            };
        });
        
        // Сохраняем все данные
        const state = {
            timestamp: Date.now(),
            currentTurnIndex,
            roundCounter,
            zoomLevel,
            translateX,
            translateY,
            combatData,
            walls
        };
        
        localStorage.setItem('combatState', JSON.stringify(state));
        console.log('Combat state saved:', state);
    } catch (error) {
        console.error('Error saving combat data:', error);
    }
}

// Добавляем сохранение эффектов к основной функции сохранения
let originalSaveCombatData = window.saveCombatData;

function enhancedSaveCombatData() {
    // Вызываем нашу основную функцию сохранения
    saveCombatData();
    
    // Сохраняем эффекты
    saveEffectsData();
}

// Заменяем оригинальную функцию на нашу расширенную версию
window.saveCombatData = enhancedSaveCombatData;

function loadCombatData() {
    try {
        const savedState = localStorage.getItem('combatState');
        if (!savedState) {
            console.log('No saved combat state found');
            return;
        }

        const state = JSON.parse(savedState);
        console.log('Loading combat state:', state);

        if (!state || !state.timestamp || Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
            console.log('Combat state is empty or expired');
            return;
        }

        // Очищаем текущее состояние
        const table = document.getElementById('combat-table');
        while (table.rows.length > 1) table.deleteRow(1);
        document.querySelectorAll('.character').forEach(char => char.remove());
        document.querySelectorAll('.wall-line, .wall-snap-point').forEach(el => el.remove());

        // Загружаем сохраненное состояние
        currentTurnIndex = state.currentTurnIndex || 0;
        roundCounter = state.roundCounter || 0;
        zoomLevel = state.zoomLevel || 1.0;
        translateX = state.translateX || 0;
        translateY = state.translateY || 0;

        // Восстанавливаем стены
        const walls = state.walls || [];
        walls.forEach(wall => {
            drawWall(wall.x1 * baseScale, wall.y1 * baseScale, wall.x2 * baseScale, wall.y2 * baseScale);
        });

        updateBattlefieldTransform();
        initializeGrid(); // Убедимся, что сетка создана

        // Создаем словарь для отслеживания количества одинаковых имен
        const nameCountMap = {};
        
        // Сначала подсчитаем количество каждого имени
        state.combatData.forEach(participant => {
            const baseName = participant.name.split(' (')[0]; // Берем имя без номера, если он уже есть
            nameCountMap[baseName] = (nameCountMap[baseName] || 0) + 1;
        });
        
        // Теперь словари для отслеживания текущего счетчика для каждого имени
        const currentCountMap = {};

        // Восстанавливаем данных участников
        const data = state.combatData || [];
        data.forEach(participant => {
            // Обрабатываем имя, чтобы добавить номер
            let name = participant.name;
            // Если имя уже содержит номер в скобках, используем его, иначе добавляем новый
            if (!name.includes(' (')) {
                const baseName = name;
                // Если есть больше одного персонажа с таким именем, добавляем номер
                if (nameCountMap[baseName] > 1) {
                    currentCountMap[baseName] = (currentCountMap[baseName] || 0) + 1;
                    name = `${baseName} (${currentCountMap[baseName]})`;
                }
            }
            
            const row = table.insertRow();
            row.classList.add('card', 'fade-in');
            row.insertCell().innerText = participant.category;
            row.insertCell().innerText = name; // Используем имя с номером
            row.insertCell().innerText = participant.initiative;
            
            // HP Cell
            const hpCell = row.insertCell();
            hpCell.contentEditable = true;
            const hpProgress = (parseInt(participant.currentHp) / parseInt(participant.maxHp)) * 100;
            hpCell.innerHTML = `
                <div>${participant.currentHp} / ${participant.maxHp}</div>
                <div class="progress-bar" style="width: ${hpProgress}%;"></div>
            `;
            hpCell.dataset.currentValue = participant.currentHp;
            hpCell.dataset.maxValue = participant.maxHp;
            
            // AC Cell
            const acCell = row.insertCell();
            acCell.innerHTML = `
                <div class="ac-container">
                    <div class="ac-circle">${participant.armorClass}</div>
                </div>
            `;
            
            // Steam Cell
            const steamCell = row.insertCell();
            steamCell.contentEditable = true;
            const steamProgress = (parseInt(participant.currentSteam) / parseInt(participant.maxSteam)) * 100;
            steamCell.innerHTML = `
                <div>⚡ ${participant.currentSteam} / ${participant.maxSteam}</div>
                <div class="steam-bar" style="width: 100%;">
                    <div class="steam-fill" style="width: ${steamProgress}%;"></div>
                </div>
            `;
            steamCell.dataset.currentValue = participant.currentSteam;
            steamCell.dataset.maxValue = participant.maxSteam;
            
            // History Cell
            const historyCell = row.insertCell();
            historyCell.innerHTML = `<span class="hp-expression">${participant.history || ''}</span>`;
            
            // Action Cell
            const actionCell = row.insertCell();
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i> Удалить';
            deleteButton.onclick = () => {
                playSound('delete.mp3');
                row.classList.add('fade-out');
                // Используем имя из ячейки таблицы, а не оригинальное имя из participant
                const charName = row.cells[1].innerText;
                removeCharacterFromBattlefield(charName);
                setTimeout(() => row.remove(), 300);
                saveCombatData();
            };
            actionCell.appendChild(deleteButton);
            
            // Добавляем персонажа на поле боя
            const pos = participant.position || { x: 0, y: 0 };
            addCharacterToBattlefield(name, participant.category === 'Игрок' ? 'player' : 'enemy', pos.x * baseScale, pos.y * baseScale, participant);
            
            // Устанавливаем обработчики событий
            hpCell.addEventListener('keypress', handleHpInput);
            steamCell.addEventListener('keypress', handleSteamInput);
        });
        
        updateRoundCounter();
        highlightCurrentTurn();
    } catch (error) {
        console.error('Error loading combat data:', error);
    }
}

// Улучшенная функция броска кубиков
function rollDice(sides) {
    console.log("Бросок d" + sides + " запущен!");
    
    // Найдем кнопку кубика
    const diceButtons = document.querySelectorAll('.dice-button');
    let clickedDice = null;
    
    diceButtons.forEach(button => {
        if (button.textContent.includes('d' + sides)) {
            clickedDice = button;
        }
    });
    
    if (clickedDice) {
        // Сначала удаляем класс, если он уже был добавлен
        clickedDice.classList.remove('dice-rolling');
        
        // Запускаем анимацию через небольшую задержку
        setTimeout(() => {
            clickedDice.classList.add('dice-rolling');
            
            // Удаляем класс после завершения анимации
            setTimeout(() => {
                clickedDice.classList.remove('dice-rolling');
            }, 800); // 0.8 секунды - длительность анимации
        }, 10);
    }
    
    // Генерируем случайное число
    const result = Math.floor(Math.random() * sides) + 1;
    
    // Показываем результат
    const resultElement = document.getElementById('diceResult');
    resultElement.textContent = `d${sides}: ${result}`;
    resultElement.classList.remove('show');
    
    // Запускаем анимацию отображения результата через небольшую задержку
    setTimeout(() => {
        resultElement.classList.add('show');
        
        // Скрываем результат через 3 секунды
        setTimeout(() => {
            resultElement.classList.remove('show');
        }, 3000);
    }, 300);
    
    // Проигрываем звук броска кубика
    playSound('dice-roll.mp3');
    
    console.log("Результат броска d" + sides + ": " + result);
    return result;
}

// Улучшенная функция с дополнительными проверками и прямым событием
function rollDice(sides) {
    console.log("Бросок d" + sides + " запущен!");
    
    try {
        // Расчет результата
        const result = Math.floor(Math.random() * sides) + 1;
        
        // Добавляем анимацию
        let diceButton = null;
        document.querySelectorAll('.dice-button').forEach(button => {
            if (button.textContent.trim() === 'd' + sides) {
                diceButton = button;
                button.classList.add('dice-rolling');
                setTimeout(() => button.classList.remove('dice-rolling'), 500);
            }
        });
        
        // Обновление и отображение результата
        const resultElement = document.getElementById('diceResult');
        if (resultElement) {
            resultElement.textContent = 'd' + sides + ': ' + result;
            resultElement.classList.add('show');
            
            // Скрытие результата через 3 секунды
            setTimeout(() => {
                resultElement.classList.remove('show');
            }, 3000);
        } else {
            console.error('Элемент diceResult не найден!');
        }
        
        // Воспроизведение звука (если функция существует)
        if (typeof playSound === 'function') {
            playSound('dice');
        }
        
        console.log("Результат броска d" + sides + ": " + result);
        return result;
    } catch (error) {
        console.error('Ошибка в функции rollDice:', error);
        return Math.floor(Math.random() * sides) + 1; // Гарантированный возврат результата даже при ошибке
    }
}

// Здесь нужно будет добавить другие функции из combat.html, которые отсутствуют
// Например, функции для работы с боевым полем и персонажами

// Инициализация боевого поля
function initializeBattlefield() {
    const battlefield = document.getElementById('battlefield');
    const battlefieldContainer = document.getElementById('battlefield-container');
    
    // Если эти функции нужны, их содержимое нужно будет тоже перенести из combat.html
    initializeGrid();
    setupBattlefieldEvents();
}

// Эта функция обновления положения боевого поля (увеличение, смещение и т.д.)
function updateBattlefieldTransform() {
    const battlefield = document.getElementById('battlefield');
    battlefield.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
}

// Модифицируем функцию addCharacterToBattlefield для работы с условиями
function addCharacterToBattlefield(name, type, x = 0, y = 0, participant = null) {
    const battlefield = document.getElementById('battlefield');
    
    // Вместо удаления существующего персонажа используем имя (с номером), переданное из вызывающей функции
    // Уникальный ID уже должен быть сформирован в функции addParticipant или loadCombatData
    const uniqueId = name;
    
    const char = document.createElement('div');
    char.classList.add('character');
    char.classList.add(type === 'player' ? 'player' : 'enemy');
    char.dataset.name = uniqueId;
    
    if (typeof x === 'object' && x !== null) {
        // Если передан объект position вместо координат
        char.style.left = x.x + 'px';
        char.style.top = x.y + 'px';
        
        if (x.conditions) {
            char.dataset.conditions = JSON.stringify(x.conditions);
        }
    } else {
        char.style.left = x + 'px';
        char.style.top = y + 'px';
        
        // Если есть данные о состояниях в participant
        if (participant && participant.position && participant.position.conditions) {
            char.dataset.conditions = JSON.stringify(participant.position.conditions);
        }
    }

    const table = document.getElementById('combat-table');
    let currentHp = 0;
    let maxHp = 0;
    let armorClass = '0';
    let currentSteam = 0;
    let maxSteam = 0;
    
    // Получаем данные из строки таблицы
    if (participant) {
        currentHp = parseInt(participant.currentHp);
        maxHp = parseInt(participant.maxHp);
        armorClass = participant.armorClass;
        currentSteam = parseInt(participant.currentSteam) || 0;
        maxSteam = parseInt(participant.maxSteam) || 0;
    } else {
        // Если participant не передан, ищем данные в таблице
        for (let i = 1; i < table.rows.length; i++) {
            if (table.rows[i].cells[1].innerText === name) {
                currentHp = parseInt(table.rows[i].cells[3].dataset.currentValue);
                maxHp = parseInt(table.rows[i].cells[3].dataset.maxValue);
                armorClass = table.rows[i].cells[4].querySelector('.ac-circle').innerText;
                currentSteam = parseInt(table.rows[i].cells[5].dataset.currentValue) || 0;
                maxSteam = parseInt(table.rows[i].cells[5].dataset.maxValue) || 0;
                break;
            }
        }
    }

    const hpContainer = document.createElement('div');
    hpContainer.classList.add('hp-container');
    
    // HP Bar
    const hpBar = document.createElement('div');
    hpBar.classList.add('hp-bar');
    const hpFill = document.createElement('div');
    hpFill.classList.add('hp-fill');
    const hpProgress = (currentHp / maxHp) * 100;
    hpFill.style.width = `${Math.max(0, Math.min(100, hpProgress))}%`;
    hpBar.appendChild(hpFill);

    const hpDisplay = document.createElement('div');
    hpDisplay.classList.add('hp-display');
    hpDisplay.innerText = `${currentHp}/${maxHp}`;
    
    // Steam Bar
    const steamBar = document.createElement('div');
    steamBar.classList.add('steam-bar');
    const steamFill = document.createElement('div');
    steamFill.classList.add('steam-fill');
    const steamProgress = (currentSteam / maxSteam) * 100;
    steamFill.style.width = `${Math.max(0, Math.min(100, steamProgress))}%`;
    steamBar.appendChild(steamFill);

    const steamDisplay = document.createElement('div');
    steamDisplay.classList.add('steam-display');
    steamDisplay.innerText = `⚡ ${currentSteam}/${maxSteam}`;

    hpContainer.appendChild(hpBar);
    hpContainer.appendChild(hpDisplay);
    hpContainer.appendChild(steamBar);
    hpContainer.appendChild(steamDisplay);

    const initial = document.createElement('div');
    initial.classList.add('initial');
    initial.innerText = name.charAt(0).toUpperCase();

    const acCircle = document.createElement('div');
    acCircle.classList.add('battlefield-ac-circle');
    acCircle.innerText = armorClass;

    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.innerText = name;

    char.appendChild(initial);
    char.appendChild(acCircle);
    char.appendChild(hpContainer);
    char.appendChild(tooltip);

    char.addEventListener('click', (e) => {
        e.stopPropagation();
        drawDistanceLines(char);
    });

    char.addEventListener('dragstart', dragStart);
    char.addEventListener('dblclick', () => {
        if (confirm(`Удалить ${name} с поля боя?`)) {
            playSound('delete.mp3');
            char.remove();
            saveCombatData();
        }
    });

    battlefield.appendChild(char);

    function dragStart(e) {
        e.dataTransfer.setData('text/plain', name);
    }

    let isDragging = false;
    let startX, startY;

    char.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX - char.offsetLeft;
        startY = e.clientY - char.offsetTop;
        char.style.zIndex = 10;
        playSound('button-click.mp3');
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            const newX = e.clientX - startX;
            const newY = e.clientY - startY;
            const maxX = battlefield.offsetWidth - char.offsetWidth;
            const maxY = battlefield.offsetHeight - char.offsetHeight;
            char.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            char.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
            drawDistanceLines(char);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            char.style.zIndex = 1;
            saveCombatData();
        }
    });

    battlefield.addEventListener('dragover', (e) => e.preventDefault());
    battlefield.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedName = e.dataTransfer.getData('text');
        if (draggedName === name) {
            const rect = battlefield.getBoundingClientRect();
            const x = e.clientX - rect.left - char.offsetWidth / 2;
            const y = e.clientY - rect.top - char.offsetHeight / 2;
            const maxX = battlefield.offsetWidth - char.offsetWidth;
            const maxY = battlefield.offsetHeight - char.offsetHeight;
            char.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            char.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            saveCombatData();
        }
    });

    // Добавляем кнопку состояний
    const conditionsButton = document.createElement('button');
    conditionsButton.classList.add('conditions-button');
    conditionsButton.innerHTML = '<i class="fas fa-plus-circle"></i>';
    conditionsButton.title = 'Управление состояниями';
    conditionsButton.onclick = (e) => {
        e.stopPropagation();
        showConditionsModal(char);
    };
    char.appendChild(conditionsButton);

    // Добавляем контейнер для состояний
    const conditionsContainer = document.createElement('div');
    conditionsContainer.classList.add('conditions-container');
    char.appendChild(conditionsContainer);

    // Обновляем состояния персонажа
    updateCharacterConditions(char);
    
    return char;
}

function removeCharacterFromBattlefield(name) {
    const chars = document.querySelectorAll('.character');
    chars.forEach(char => {
        // Проверяем только точное совпадение имени
        if (char.dataset.name === name) {
            char.remove();
        }
    });
}

// Добавляем функцию переключения отображения футов
function toggleFeetDisplay() {
    showFeetDistance = !showFeetDistance;
    
    // Обновляем отображение расстояний
    const selectedChar = document.querySelector('.character.current-player') || document.querySelector('.character');
    if (selectedChar) {
        drawDistanceLines(selectedChar);
    }
    
    // Обновляем все метки расстояний на поле
    document.querySelectorAll('.distance-label').forEach(label => {
        label.style.display = showFeetDistance ? 'block' : 'none';
    });
}

// Функция отображения линий расстояний
function drawDistanceLines(selectedChar) {
    const battlefield = document.getElementById('battlefield');
    document.querySelectorAll('.distance-line, .distance-label').forEach(el => el.remove());

    if (!showFeetDistance) return; // Если отображение футов выключено, не рисуем линии

    const selectedX = parseFloat(selectedChar.style.left) + selectedChar.offsetWidth / 2;
    const selectedY = parseFloat(selectedChar.style.top) + selectedChar.offsetHeight / 2;

    document.querySelectorAll('.character').forEach(char => {
        if (char !== selectedChar) {
            const charX = parseFloat(char.style.left) + char.offsetWidth / 2;
            const charY = parseFloat(char.style.top) + char.offsetHeight / 2;

            const dx = charX - selectedX;
            const dy = charY - selectedY;
            const distance = Math.sqrt(dx * dx + dy * dy) / baseScale;

            const line = document.createElement('div');
            line.classList.add('distance-line');
            line.style.left = selectedX + 'px';
            line.style.top = selectedY + 'px';
            line.style.width = Math.sqrt(dx * dx + dy * dy) + 'px';
            line.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;

            const label = document.createElement('div');
            label.classList.add('distance-label');
            label.innerText = `${Math.round(distance)} футов`;
            const labelX = selectedX + dx / 2;
            const labelY = selectedY + dy / 2;
            label.style.left = labelX + 'px';
            label.style.top = labelY + 'px';

            battlefield.appendChild(line);
            battlefield.appendChild(label);
        }
    });
}

// Функция для инициализации сетки боевого поля
function initializeGrid() {
    const battlefield = document.getElementById('battlefield');
    
    // Проверяем, есть ли уже сетка
    if (battlefield.querySelector('.grid-cell')) {
        return; // Если сетка уже есть, выходим
    }
    
    // Создаем клетки сетки
    for (let x = 0; x < battlefieldSize; x += gridSize) {
        for (let y = 0; y < battlefieldSize; y += gridSize) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.style.left = x + 'px';
            cell.style.top = y + 'px';
            cell.dataset.x = x.toString();
            cell.dataset.y = y.toString();
            battlefield.appendChild(cell);
        }
    }
}

// Функция настройки событий для боевого поля
function setupBattlefieldEvents() {
    const battlefieldContainer = document.getElementById('battlefield-container');
    const battlefield = document.getElementById('battlefield');

    battlefieldContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = battlefieldContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const mapX = (mouseX - translateX) / zoomLevel;
        const mapY = (mouseY - translateY) / zoomLevel;

        const oldZoom = zoomLevel;
        zoomLevel = Math.min(zoomMax, Math.max(zoomMin, zoomLevel - e.deltaY * 0.0005));

        const newMouseX = mapX * zoomLevel + translateX;
        const newMouseY = mapY * zoomLevel + translateY;

        translateX -= (newMouseX - mouseX);
        translateY -= (newMouseY - mouseY);

        const scaledWidth = battlefieldSize * zoomLevel;
        const scaledHeight = battlefieldSize * zoomLevel;
        const containerWidth = battlefieldContainer.offsetWidth;
        const containerHeight = battlefieldContainer.offsetHeight;

        translateX = Math.min(containerWidth * 0.5, Math.max(translateX, -(scaledWidth - containerWidth * 0.5)));
        translateY = Math.min(containerHeight * 0.5, Math.max(translateY, -(scaledHeight - containerHeight * 0.5)));

        updateBattlefieldTransform();
        saveCombatData();
        drawDistanceLines(document.querySelector('.character.current-player') || document.querySelector('.character'));
    });

    battlefieldContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('character')) return;

        if (isDrawingWall) {
            e.preventDefault();
            if (wallStartX === null && wallStartY === null) {
                // Проверяем, кликнули ли мы по точке привязки
                if (e.target.classList.contains('wall-snap-point')) {
                    // Используем координаты точки привязки
                    wallStartX = parseFloat(e.target.dataset.x);
                    wallStartY = parseFloat(e.target.dataset.y);
                    
                    // Визуальный эффект для точки привязки
                    e.target.style.backgroundColor = '#4682b4';
                    e.target.style.boxShadow = '0 0 10px #4682b4';
                    
                    setTimeout(() => {
                        e.target.style.backgroundColor = '';
                        e.target.style.boxShadow = '';
                    }, 300);
                    
                    console.log('Wall start from snap point:', wallStartX, wallStartY);
                } else {
                    // Получаем координаты клика относительно viewport
                    const clientX = e.clientX;
                    const clientY = e.clientY;
                    
                    // Получаем границы поля боя
                    const rect = battlefield.getBoundingClientRect();
                    
                    // Вычисляем позицию клика относительно поля боя
                    const viewportX = clientX - rect.left;
                    const viewportY = clientY - rect.top;
                    
                    // Учитываем текущий зум и смещение
                    // ВАЖНОЕ ИСПРАВЛЕНИЕ: используем правильную формулу пересчета координат
                    wallStartX = viewportX / zoomLevel - translateX / zoomLevel;
                    wallStartY = viewportY / zoomLevel - translateY / zoomLevel;
                    
                    // Привязка к сетке
                    const gridSize = 50;
                    wallStartX = Math.round(wallStartX / gridSize) * gridSize;
                    wallStartY = Math.round(wallStartY / gridSize) * gridSize;
                    
                    // Визуальный индикатор начальной точки
                    const indicator = document.createElement('div');
                    indicator.className = 'wall-start-indicator';
                    indicator.style.position = 'absolute';
                    indicator.style.left = wallStartX + 'px';
                    indicator.style.top = wallStartY + 'px';
                    indicator.style.width = '14px';
                    indicator.style.height = '14px';
                    indicator.style.borderRadius = '50%';
                    indicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                    indicator.style.zIndex = '100';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    battlefield.appendChild(indicator);
                    
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.parentNode.removeChild(indicator);
                        }
                    }, 300);
                    
                    console.log('Wall start from grid:', wallStartX, wallStartY);
                }
            }
        } else {
            isDraggingMap = true;
            startDragX = e.clientX - translateX;
            startDragY = e.clientY - translateY;
            battlefieldContainer.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingMap) {
            translateX = e.clientX - startDragX;
            translateY = e.clientY - startDragY;

            const scaledWidth = battlefieldSize * zoomLevel;
            const scaledHeight = battlefieldSize * zoomLevel;
            const containerWidth = battlefieldContainer.offsetWidth;
            const containerHeight = battlefieldContainer.offsetHeight;

            translateX = Math.min(containerWidth * 0.5, Math.max(translateX, -(scaledWidth - containerWidth * 0.5)));
            translateY = Math.min(containerHeight * 0.5, Math.max(translateY, -(scaledHeight - containerHeight * 0.5)));

            updateBattlefieldTransform();
        } else if (isDrawingWall && wallStartX !== null && wallStartY !== null) {
            // Получаем координаты мыши относительно viewport
            const clientX = e.clientX;
            const clientY = e.clientY;
            
            // Получаем границы поля боя
            const rect = battlefield.getBoundingClientRect();
            
            // Вычисляем позицию мыши относительно поля боя
            const viewportX = clientX - rect.left;
            const viewportY = clientY - rect.top;
            
            // Учитываем текущий зум и смещение
            // Используем правильную формулу пересчета координат
            const currentX = viewportX / zoomLevel - translateX / zoomLevel;
            const currentY = viewportY / zoomLevel - translateY / zoomLevel;
            
            // Обновляем временную стену
            updateTempWall(wallStartX, wallStartY, currentX, currentY);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDraggingMap) {
            isDraggingMap = false;
            battlefieldContainer.style.cursor = isDrawingWall ? 'crosshair' : 'grab';
            saveCombatData();
        } else if (isDrawingWall && wallStartX !== null && wallStartY !== null) {
            // Проверяем, закончили ли мы на точке привязки
            if (e.target.classList.contains('wall-snap-point')) {
                const endX = parseFloat(e.target.dataset.x);
                const endY = parseFloat(e.target.dataset.y);
                
                // Визуальный эффект для точки привязки
                e.target.style.backgroundColor = '#4682b4';
                e.target.style.boxShadow = '0 0 10px #4682b4';
                
                setTimeout(() => {
                    e.target.style.backgroundColor = '';
                    e.target.style.boxShadow = '';
                }, 300);
                
                // Вычисляем расстояние от начальной точки
                const dx = endX - wallStartX;
                const dy = endY - wallStartY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Если расстояние достаточное, создаем стену
                if (distance > 25) {
                    drawWall(wallStartX, wallStartY, endX, endY);
                    console.log('Wall end at snap point:', endX, endY);
                    
                    try {
                        playSound('wall-build.mp3');
                    } catch (e) {
                        console.log('Звук недоступен');
                    }
                }
            } else {
                // Получаем координаты мыши относительно viewport
                const clientX = e.clientX;
                const clientY = e.clientY;
                
                // Получаем границы поля боя
                const rect = battlefield.getBoundingClientRect();
                
                // Вычисляем позицию мыши относительно поля боя
                const viewportX = clientX - rect.left;
                const viewportY = clientY - rect.top;
                
                // Учитываем текущий зум и смещение с правильной формулой
                const currentX = viewportX / zoomLevel - translateX / zoomLevel;
                const currentY = viewportY / zoomLevel - translateY / zoomLevel;
                
                // Вычисляем расстояние от начальной точки
                const dx = currentX - wallStartX;
                const dy = currentY - wallStartY;
                const distance = Math.sqrt(dx * dx + dy * dy);
        
                // Привязка к сетке
                const gridSize = 50;
                const snapX = Math.round(currentX / gridSize) * gridSize;
                const snapY = Math.round(currentY / gridSize) * gridSize;
                
                // Если расстояние достаточное, создаем стену
                if (distance > 25) {
                    drawWall(wallStartX, wallStartY, snapX, snapY);
                    console.log('Wall end at grid:', snapX, snapY);
                    
                    try {
                        playSound('wall-build.mp3');
                    } catch (e) {
                        console.log('Звук недоступен');
                    }
                }
            }
            
            // Удаляем временную стену
            const tempLine = battlefield.querySelector('.temp-wall');
            if (tempLine) tempLine.remove();
            
            // Сбрасываем начальные координаты
            wallStartX = null;
            wallStartY = null;
            
            // Сохраняем данные
            saveCombatData();
        }
    });
}

function updateTempWall(startX, startY, currentX, currentY) {
    const battlefield = document.getElementById('battlefield');
    
    // Удаляем предыдущую временную стену если есть
    const oldTempLine = battlefield.querySelector('.temp-wall');
    if (oldTempLine) {
        oldTempLine.remove();
    }
    
    // Создаем новую временную стену
    const tempLine = document.createElement('div');
    tempLine.classList.add('wall-line', 'temp-wall');
    battlefield.appendChild(tempLine);
    
    // Привязка к сетке
    const gridSize = 50;
    const snapX = Math.round(currentX / gridSize) * gridSize;
    const snapY = Math.round(currentY / gridSize) * gridSize;
    
    // Вычисляем параметры стены
    const dx = snapX - startX;
    const dy = snapY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Устанавливаем стиль с точным позиционированием
    tempLine.style.left = `${startX}px`;
    tempLine.style.top = `${startY}px`;
    tempLine.style.width = `${length}px`;
    tempLine.style.transformOrigin = '0 0';
    tempLine.style.transform = `rotate(${angle}deg)`;
    
    return { snapX, snapY };
}

function drawWall(x1, y1, x2, y2) {
    const battlefield = document.getElementById('battlefield');
    
    // Привязка к сетке
    const gridSize = 50;
    x1 = Math.round(x1 / gridSize) * gridSize;
    y1 = Math.round(y1 / gridSize) * gridSize;
    x2 = Math.round(x2 / gridSize) * gridSize;
    y2 = Math.round(y2 / gridSize) * gridSize;
    
    // Проверка на минимальную длину
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 25) {
        console.log('Стена слишком короткая, отмена');
        return null;
    }
    
    // Вычисляем угол для поворота линии
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Создаём линию стены
    const line = document.createElement('div');
    line.classList.add('wall-line');
    line.style.position = 'absolute';
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.width = `${length}px`;
    line.style.transformOrigin = '0 0';
    line.style.transform = `rotate(${angle}deg)`;
    line.style.zIndex = '10';
    battlefield.appendChild(line);
    
    // Создаём точки привязки на концах
    const startPoint = document.createElement('div');
    startPoint.classList.add('wall-snap-point');
    startPoint.style.position = 'absolute';
    startPoint.style.left = `${x1}px`;
    startPoint.style.top = `${y1}px`;
    startPoint.dataset.x = x1;
    startPoint.dataset.y = y1;
    startPoint.style.transform = 'translate(-50%, -50%)';
    battlefield.appendChild(startPoint);
    
    const endPoint = document.createElement('div');
    endPoint.classList.add('wall-snap-point');
    endPoint.style.position = 'absolute';
    endPoint.style.left = `${x2}px`;
    endPoint.style.top = `${y2}px`;
    endPoint.dataset.x = x2;
    endPoint.dataset.y = y2;
    endPoint.style.transform = 'translate(-50%, -50%)';
    battlefield.appendChild(endPoint);
    
    // Добавляем обработчик двойного клика для удаления
    line.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (confirm('Удалить эту стену?')) {
            const index = wallHistory.findIndex(w => w.line === line);
            if (index !== -1) {
                wallHistory.splice(index, 1);
            }
            line.remove();
            startPoint.remove();
            endPoint.remove();
            saveCombatData();
        }
    });
    
    // Добавляем стену в историю
    wallHistory.push({ line, startPoint, endPoint });
    
    return { line, startPoint, endPoint };
}

// Полная инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация боевого поля
    initializeBattlefield();
    initializeGrid();
    setupBattlefieldEvents();
    setupConditionsSystem();
    
    // Загрузка данных
    loadParticipantList();
    loadCombatData();
    updateRoundCounter();
    highlightCurrentTurn();
    
    // Инициализация событий для элементов на странице
    document.getElementById('participant-type').addEventListener('change', loadParticipantList);
    
    // Добавляем обработчик beforeunload
    window.addEventListener('beforeunload', (e) => {
        saveCombatData();
    });

    // Добавляем обработчик для перехода по ссылкам
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            saveCombatData();
        }
    });

    // Добавляем автоматическое сохранение каждые 30 секунд
    setInterval(saveCombatData, 30000);
});

// Функции для работы с эффектами на карте боя
let battleEffects = [];
let effectIdCounter = 0;
let isEffectAnimationsEnabled = true;

// Открытие модального окна для создания эффекта
function openEffectModal() {
    document.getElementById('effect-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
    
    // Воспроизведение звука (если функция существует)
    if (typeof playSound === 'function') {
        playSound('ui');
    }
    
    // Сброс формы при открытии
    document.getElementById('effect-name').value = '';
    document.getElementById('effect-color').value = '#ff5722';
    document.getElementById('effect-size').value = 15; // 15 футов по умолчанию
    document.getElementById('effect-opacity').value = 0.6;
    document.getElementById('effect-duration').value = 10;
    document.getElementById('effect-animation').value = 'none';
    
    // Сброс активных классов для пресетов
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.classList.remove('active');
    });
    
    document.querySelectorAll('.size-preset').forEach(preset => {
        preset.classList.remove('active');
    });
    
    // Активируем пресет размера 15 футов по умолчанию
    document.querySelectorAll('.size-preset').forEach(preset => {
        if (preset.getAttribute('data-size') === '15') {
            preset.classList.add('active');
        }
    });
    
    // Сбрасываем ID редактируемого эффекта
    document.getElementById('effect-modal').dataset.editEffectId = '';
    
    // Сбрасываем текст кнопки и обработчик
    const createButton = document.getElementById('create-effect-button');
    if (createButton) {
        createButton.textContent = 'Создать';
        createButton.onclick = function() {
            // Определение позиции (центр видимой области карты)
            const battlefield = document.getElementById('battlefield');
            const battlefieldRect = battlefield.getBoundingClientRect();
            const centerX = (battlefield.scrollLeft + (battlefieldRect.width / 2)) / gridSize;
            const centerY = (battlefield.scrollTop + (battlefieldRect.height / 2)) / gridSize;
            
            // Вызываем функцию createEffect напрямую
            createEffect(centerX, centerY);
            // Сохраняем данные эффектов
            saveEffectsData();
        };
    }
}

// Закрытие модального окна
function closeEffectModal() {
    document.getElementById('effect-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

// Создание эффекта
function createEffect(x, y) {
    const name = document.getElementById('effect-name').value || 'Эффект';
    const color = document.getElementById('effect-color').value;
    const sizeInFeet = parseInt(document.getElementById('effect-size').value);
    // Преобразуем размер из футов в пиксели (5 футов = gridSize)
    const sizeInPixels = Math.round((sizeInFeet / 5) * gridSize);
    
    const opacity = parseFloat(document.getElementById('effect-opacity').value);
    const duration = parseInt(document.getElementById('effect-duration').value);
    const animation = document.getElementById('effect-animation').value;
    
    // Создание нового эффекта
    const effectId = 'effect-' + effectIdCounter++;
    const effect = {
        id: effectId,
        name: name,
        color: color,
        size: sizeInPixels, // Храним в пикселях для отображения
        sizeInFeet: sizeInFeet, // Храним в футах для редактирования
        opacity: opacity,
        duration: duration,
        animation: animation,
        x: x,
        y: y,
        remaining: duration
    };
    
    battleEffects.push(effect);
    renderEffect(effect);
    updateBattleEffectsList();
    closeEffectModal();
    
    // Воспроизведение звука (если функция существует)
    if (typeof playSound === 'function') {
        playSound('create');
    }
}

// Отрисовка эффекта на карте
function renderEffect(effect) {
    const battlefield = document.getElementById('battlefield');
    
    // Удалить старый элемент, если он существует
    const existingElement = document.getElementById(effect.id);
    if (existingElement) {
        existingElement.remove();
    }
    
    // Создание нового элемента
    const effectElement = document.createElement('div');
    effectElement.id = effect.id;
    effectElement.className = 'battle-effect';
    
    // Установка стилей
    effectElement.style.width = effect.size + 'px';
    effectElement.style.height = effect.size + 'px';
    effectElement.style.backgroundColor = hexToRgba(effect.color, effect.opacity);
    effectElement.style.left = (effect.x * gridSize) - (effect.size / 2) + 'px';
    effectElement.style.top = (effect.y * gridSize) - (effect.size / 2) + 'px';
    
    // Добавление анимации, если она включена
    if (isEffectAnimationsEnabled && effect.animation !== 'none') {
        // Для анимации пульсации используем отдельный внутренний элемент,
        // чтобы избежать конфликтов с трансформацией при перетаскивании
        if (effect.animation === 'pulse') {
            const pulseElement = document.createElement('div');
            pulseElement.className = 'effect-animation-pulse';
            pulseElement.style.position = 'absolute';
            pulseElement.style.width = '100%';
            pulseElement.style.height = '100%';
            pulseElement.style.top = '0';
            pulseElement.style.left = '0';
            pulseElement.style.borderRadius = '50%';
            pulseElement.style.background = hexToRgba(effect.color, effect.opacity / 2);
            effectElement.appendChild(pulseElement);
        } else {
            effectElement.classList.add('effect-animation-' + effect.animation);
        }
    }
    
    // Добавление названия эффекта
    const nameElement = document.createElement('div');
    nameElement.className = 'effect-name';
    nameElement.textContent = effect.name;
    effectElement.appendChild(nameElement);
    
    // Добавление размера в футах
    const sizeInFeet = effect.sizeInFeet || Math.round((effect.size / gridSize) * 5);
    const sizeElement = document.createElement('div');
    sizeElement.className = 'effect-size';
    sizeElement.textContent = sizeInFeet + ' фт.';
    effectElement.appendChild(sizeElement);
    
    // Добавление счетчика оставшегося времени
    if (effect.duration > 0) {
        const durationElement = document.createElement('div');
        durationElement.className = 'effect-duration';
        durationElement.textContent = effect.remaining + ' раунд.';
        effectElement.appendChild(durationElement);
    }
    
    // Добавление кнопок управления
    const controlsElement = document.createElement('div');
    controlsElement.className = 'effect-controls';
    
    // Кнопка редактирования
    const editButton = document.createElement('div');
    editButton.className = 'effect-control-button';
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.title = 'Редактировать';
    editButton.onclick = (e) => {
        e.stopPropagation();
        editEffect(effect.id);
    };
    controlsElement.appendChild(editButton);
    
    // Кнопка удаления
    const deleteButton = document.createElement('div');
    deleteButton.className = 'effect-control-button';
    deleteButton.innerHTML = '<i class="fas fa-times"></i>';
    deleteButton.title = 'Удалить';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        removeEffect(effect.id);
    };
    controlsElement.appendChild(deleteButton);
    
    effectElement.appendChild(controlsElement);
    
    // Добавление обработчика для перетаскивания
    effectElement.addEventListener('mousedown', startDraggingEffect);
    
    // Добавление эффекта на карту
    battlefield.appendChild(effectElement);
}

// Перевод hex цвета в rgba
function hexToRgba(hex, opacity) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Обработчики событий для перетаскивания эффектов
let draggingEffect = null;
let initialEffectX, initialEffectY;
let initialMouseX, initialMouseY;

function startDraggingEffect(e) {
    // Игнорируем событие, если кликнули по кнопкам управления
    if (e.target.closest('.effect-controls')) {
        return;
    }
    
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие события, чтобы не двигалась карта
    
    draggingEffect = this;
    const effectId = draggingEffect.id;
    const effect = battleEffects.find(effect => effect.id === effectId);
    
    // Сохраняем начальные позиции
    initialEffectX = effect.x;
    initialEffectY = effect.y;
    initialMouseX = e.clientX;
    initialMouseY = e.clientY;
    
    document.addEventListener('mousemove', moveEffect);
    document.addEventListener('mouseup', stopDraggingEffect);
    
    // Добавление класса перетаскивания
    draggingEffect.classList.add('dragging');
    
    // Воспроизведение звука (если функция существует)
    if (typeof playSound === 'function') {
        playSound('move');
    }
}

function moveEffect(e) {
    if (!draggingEffect) return;
    
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие события
    
    const effectId = draggingEffect.id;
    const effect = battleEffects.find(effect => effect.id === effectId);
    
    // Рассчитываем новую позицию
    const dx = e.clientX - initialMouseX;
    const dy = e.clientY - initialMouseY;
    effect.x = initialEffectX + (dx / gridSize);
    effect.y = initialEffectY + (dy / gridSize);
    
    // Обновляем позицию элемента
    draggingEffect.style.left = (effect.x * gridSize) - (effect.size / 2) + 'px';
    draggingEffect.style.top = (effect.y * gridSize) - (effect.size / 2) + 'px';
}

function stopDraggingEffect(e) {
    if (!draggingEffect) return;
    
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // Останавливаем всплытие события
    }
    
    // Удаляем класс перетаскивания
    draggingEffect.classList.remove('dragging');
    draggingEffect = null;
    
    document.removeEventListener('mousemove', moveEffect);
    document.removeEventListener('mouseup', stopDraggingEffect);
    
    // Сохраняем состояние эффектов
    saveEffectsData();
}

// Удаление эффекта
function removeEffect(effectId) {
    const index = battleEffects.findIndex(effect => effect.id === effectId);
    if (index !== -1) {
        battleEffects.splice(index, 1);
        const element = document.getElementById(effectId);
        if (element) {
            element.remove();
        }
        updateBattleEffectsList();
        
        // Воспроизведение звука (если функция существует)
        if (typeof playSound === 'function') {
            playSound('delete');
        }
    }
}

// Редактирование эффекта
function editEffect(effectId) {
    const effect = battleEffects.find(effect => effect.id === effectId);
    if (!effect) return;
    
    // Открытие модального окна и заполнение данными
    openEffectModal();
    
    document.getElementById('effect-name').value = effect.name;
    document.getElementById('effect-color').value = effect.color;
    
    // Используем сохраненный размер в футах или конвертируем из пикселей
    const sizeInFeet = effect.sizeInFeet || Math.round((effect.size / gridSize) * 5);
    document.getElementById('effect-size').value = sizeInFeet;
    
    document.getElementById('effect-opacity').value = effect.opacity;
    document.getElementById('effect-duration').value = effect.duration;
    document.getElementById('effect-animation').value = effect.animation;
    
    // Активируем соответствующий пресет цвета, если такой есть
    document.querySelectorAll('.color-preset').forEach(preset => {
        if (preset.getAttribute('data-color') === effect.color) {
            preset.classList.add('active');
        }
    });
    
    // Активируем соответствующий пресет размера, если такой есть
    document.querySelectorAll('.size-preset').forEach(preset => {
        if (preset.getAttribute('data-size') == sizeInFeet) {
            preset.classList.add('active');
        }
    });
    
    // Сохраняем ID эффекта для обновления вместо создания нового
    document.getElementById('effect-modal').dataset.editEffectId = effectId;
    
    // Изменяем текст кнопки на "Сохранить" и обновляем обработчик
    const createButton = document.getElementById('create-effect-button');
    if (createButton) {
        createButton.textContent = 'Сохранить';
        createButton.onclick = function() {
            // Вызываем оригинальную функцию обновления эффекта
            updateEffect(effectId);
        };
    }
}

// Функция обновления существующего эффекта
function updateEffect(effectId) {
    const effect = battleEffects.find(effect => effect.id === effectId);
    if (!effect) return;
    
    effect.name = document.getElementById('effect-name').value || 'Эффект';
    effect.color = document.getElementById('effect-color').value;
    effect.sizeInFeet = parseInt(document.getElementById('effect-size').value);
    effect.size = Math.round((effect.sizeInFeet / 5) * gridSize); // Конвертируем футы в пиксели
    effect.opacity = parseFloat(document.getElementById('effect-opacity').value);
    effect.duration = parseInt(document.getElementById('effect-duration').value);
    effect.animation = document.getElementById('effect-animation').value;
    effect.remaining = effect.duration; // Обновляем оставшееся время
    
    // Перерисовываем эффект
    renderEffect(effect);
    
    // Закрываем модальное окно
    closeEffectModal();
    
    // Сохраняем состояние эффектов
    saveEffectsData();
    
    // Воспроизведение звука (если функция существует)
    if (typeof playSound === 'function') {
        playSound('update');
    }
}

// Обновление счетчика раундов для эффектов
function updateEffectsDuration() {
    // Проверяем, находимся ли мы в начале нового раунда
    // Если currentTurnIndex не равен 0, значит это не смена раунда, а просто следующий ход
    if (currentTurnIndex !== 0) return;
    
    for (let effect of battleEffects) {
        if (effect.duration > 0 && effect.remaining > 0) {
            effect.remaining--;
            
            // Если время эффекта истекло, удаляем его
            if (effect.remaining <= 0) {
                setTimeout(() => {
                    removeEffect(effect.id);
                }, 500);
            } else {
                // Обновляем отображение оставшегося времени
                const element = document.getElementById(effect.id);
                if (element) {
                    const durationElement = element.querySelector('.effect-duration');
                    if (durationElement) {
                        durationElement.textContent = effect.remaining + ' раунд.';
                    }
                }
            }
        }
    }
    
    updateBattleEffectsList();
}

// Обновление списка эффектов в панели управления
function updateBattleEffectsList() {
    // Если есть функция обновления интерфейса, мы можем добавить в неё обновление списка эффектов
    // Для упрощения этот функционал пока оставим пустым
}

// Включение/отключение анимаций эффектов
function toggleEffectAnimations() {
    // Переключаем отображение футов
    toggleFeetDisplay();
    
    // Переключаем анимации эффектов
    isEffectAnimationsEnabled = !isEffectAnimationsEnabled;
    
    for (let effect of battleEffects) {
        const element = document.getElementById(effect.id);
        if (element) {
            // Обновляем отображение анимаций для всех эффектов
            
            // Сначала удаляем все анимации
            element.classList.remove('effect-animation-fade', 'effect-animation-wave');
            const pulseElement = element.querySelector('.effect-animation-pulse');
            if (pulseElement) {
                pulseElement.remove();
            }
            
            // Добавляем анимацию, если она включена
            if (isEffectAnimationsEnabled && effect.animation !== 'none') {
                if (effect.animation === 'pulse') {
                    const newPulseElement = document.createElement('div');
                    newPulseElement.className = 'effect-animation-pulse';
                    newPulseElement.style.position = 'absolute';
                    newPulseElement.style.width = '100%';
                    newPulseElement.style.height = '100%';
                    newPulseElement.style.top = '0';
                    newPulseElement.style.left = '0';
                    newPulseElement.style.borderRadius = '50%';
                    newPulseElement.style.background = hexToRgba(effect.color, effect.opacity / 2);
                    element.appendChild(newPulseElement);
                } else {
                    element.classList.add('effect-animation-' + effect.animation);
                }
            }
        }
    }
    
    // Воспроизведение звука (если функция существует)
    if (typeof playSound === 'function') {
        playSound('ui');
    }
    
    // Обновление текста кнопки, если она существует
    const animButton = document.getElementById('toggle-animations-button');
    if (animButton) {
        animButton.innerHTML = isEffectAnimationsEnabled 
            ? '<i class="fas fa-eye"></i>' 
            : '<i class="fas fa-eye-slash"></i>';
        animButton.title = isEffectAnimationsEnabled && showFeetDistance
            ? 'Отключить анимации и футы' 
            : 'Включить анимации и футы';
    }
}

// Инициализация событий для модального окна и пресетов
function initEffectsSystem() {
    // Проверяем, что необходимые элементы существуют
    const modalOverlay = document.getElementById('modal-overlay');
    const closeEffectModalBtn = document.getElementById('close-effect-modal');
    const createEffectBtn = document.getElementById('create-effect-button');
    const cancelEffectBtn = document.getElementById('cancel-effect-button');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeEffectModal);
    }
    
    if (closeEffectModalBtn) {
        closeEffectModalBtn.addEventListener('click', closeEffectModal);
    }
    
    // Удаляем неправильный обработчик для кнопки создания эффекта
    // Правильный обработчик устанавливается в openEffectModal
    if (cancelEffectBtn) {
        cancelEffectBtn.addEventListener('click', closeEffectModal);
    }
    
    // Обработчики для пресетов цветов
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            const effectColorInput = document.getElementById('effect-color');
            if (effectColorInput) {
                effectColorInput.value = color;
            }
            
            // Обновление активного класса
            document.querySelectorAll('.color-preset').forEach(p => {
                p.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Обработчики для пресетов размеров
    document.querySelectorAll('.size-preset').forEach(preset => {
        preset.addEventListener('click', function() {
            const size = this.getAttribute('data-size');
            const effectSizeInput = document.getElementById('effect-size');
            if (effectSizeInput) {
                effectSizeInput.value = size;
            }
            
            // Обновление активного класса
            document.querySelectorAll('.size-preset').forEach(p => {
                p.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Обработчик для кнопки создания эффекта
    const createEffectButton = document.getElementById('create-effect-button-main');
    if (createEffectButton) {
        createEffectButton.addEventListener('click', openEffectModal);
    }
    
    // Обработчик для кнопки переключения анимаций
    const toggleAnimationsButton = document.getElementById('toggle-animations-button');
    if (toggleAnimationsButton) {
        toggleAnimationsButton.addEventListener('click', toggleEffectAnimations);
    }
    
    // Связываем обновление эффектов с функцией перехода хода
    const originalNextTurn = window.nextTurn;
    window.nextTurn = function() {
        // Запоминаем предыдущий индекс хода перед вызовом оригинальной функции
        const prevTurnIndex = currentTurnIndex;
        
        if (typeof originalNextTurn === 'function') {
            originalNextTurn();
        }
        
        // Если после перехода к следующему ходу currentTurnIndex стал 0,
        // значит начался новый раунд, и нужно обновить счетчики эффектов
        if (currentTurnIndex === 0 && prevTurnIndex !== 0) {
            updateEffectsDuration();
        }
    };
    
    // Загружаем сохранённые эффекты
    loadEffectsData();
    
    console.log("Система эффектов инициализирована");
}

// Загрузка данных об эффектах
function loadEffectsData() {
    const savedEffects = localStorage.getItem('battleEffects');
    if (savedEffects) {
        try {
            battleEffects = JSON.parse(savedEffects);
            
            // Отрисовка всех эффектов
            battleEffects.forEach(effect => {
                renderEffect(effect);
            });
            
            // Обновление счетчика id, чтобы не было конфликтов
            if (battleEffects.length > 0) {
                const maxId = Math.max(...battleEffects.map(effect => {
                    const idNum = parseInt(effect.id.replace('effect-', ''), 10);
                    return isNaN(idNum) ? 0 : idNum;
                }));
                effectIdCounter = maxId + 1;
            }
        } catch (e) {
            console.error('Ошибка при загрузке данных эффектов:', e);
            battleEffects = [];
        }
    }
}

// Сохранение данных об эффектах
function saveEffectsData() {
    localStorage.setItem('battleEffects', JSON.stringify(battleEffects));
}

// Обновляем функцию createEffect для автоматического сохранения
const originalCreateEffect = createEffect;
createEffect = function(x, y) {
    // Просто вызываем оригинальную функцию и сохраняем результат
    // а не создаем эффект дважды
    originalCreateEffect(x, y);
    saveEffectsData();
};

// Обновляем функцию removeEffect для автоматического сохранения
const originalRemoveEffect = removeEffect;
removeEffect = function(effectId) {
    originalRemoveEffect(effectId);
    saveEffectsData();
};

// Обновляем функцию stopDraggingEffect для автоматического сохранения
const originalStopDraggingEffect = stopDraggingEffect;
stopDraggingEffect = function() {
    originalStopDraggingEffect();
    if (draggingEffect) {
        saveEffectsData();
    }
};

// Запуск инициализации после загрузки страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffectsSystem);
} else {
    initEffectsSystem();
}

// Функция для инициализации обработчиков событий для кубиков
function initDiceEventListeners() {
    console.log("Инициализация обработчиков событий для кубиков...");
    const diceButtons = [
        { selector: '.dice-d20', sides: 20 },
        { selector: '.dice-d12', sides: 12 },
        { selector: '.dice-d10', sides: 10 },
        { selector: '.dice-d8', sides: 8 },
        { selector: '.dice-d6', sides: 6 },
        { selector: '.dice-d4', sides: 4 }
    ];
    
    diceButtons.forEach(dice => {
        const button = document.querySelector(dice.selector);
        if (button) {
            console.log(`Добавляем обработчик для ${dice.selector}`);
            
            // Удаляем существующие обработчики
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Добавляем новый обработчик
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Клик по кубику d${dice.sides}`);
                rollDice(dice.sides);
                return false;
            });
        } else {
            console.error(`Кнопка ${dice.selector} не найдена!`);
        }
    });
}

// Добавляем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded - инициализация кубиков...");
    initDiceEventListeners();
    
    // Инициализация через таймаут для гарантии загрузки всего DOM
    setTimeout(initDiceEventListeners, 1000);
}); 