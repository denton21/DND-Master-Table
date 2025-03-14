// Глобальные переменные
let currentTurnIndex = 0;
let roundCounter = 0;
const battlefieldSize = 1000; // Фиксированный размер в пикселях (1000x1000px)
const baseScale = 8.33; // Масштаб: 1 клетка = 5 футов, 1 фут = ~8.33px

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

    const table = document.getElementById('combat-table');
    const row = table.insertRow();
    row.classList.add('card', 'fade-in');
    row.insertCell().innerText = type === 'player' ? 'Игрок' : 'Враг';
    row.insertCell().innerText = name;
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
        removeCharacterFromBattlefield(name);
        setTimeout(() => row.remove(), 300);
        saveCombatData();
    };
    actionCell.appendChild(deleteButton);

    addCharacterToBattlefield(name, type);

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
    document.querySelectorAll('.character').forEach(char => {
        char.classList.remove('current-player');
    });

    for (let i = 1; i < table.rows.length; i++) {
        table.rows[i].classList.remove('current-turn');
        if (i - 1 === currentTurnIndex) {
            table.rows[i].classList.add('current-turn');
            const name = table.rows[i].cells[1].innerText;
            const char = Array.from(document.querySelectorAll('.character')).find(c => c.dataset.name === name);
            if (char && char.classList.contains('player')) {
                char.classList.add('current-player');
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

function saveCombatData() {
    const table = document.getElementById('combat-table');
    const data = [];
    const characters = {};
    const walls = [];

    try {
        // Сохраняем позиции персонажей
        document.querySelectorAll('.character').forEach(char => {
            const name = char.dataset.name;
            const x = parseFloat(char.style.left.replace('px', '')) || 0;
            const y = parseFloat(char.style.top.replace('px', '')) || 0;
            const conditions = char.dataset.conditions ? JSON.parse(char.dataset.conditions) : [];
            characters[name] = { 
                x: x / baseScale, 
                y: y / baseScale,
                conditions: conditions
            };
        });

        // Сохраняем стены
        document.querySelectorAll('.wall-line').forEach(wall => {
            if (!wall.classList.contains('temp-wall')) {
                const x1 = parseFloat(wall.style.left.replace('px', '')) || 0;
                const y1 = parseFloat(wall.style.top.replace('px', '')) || 0;
                const width = parseFloat(wall.style.width.replace('px', '')) || 0;
                const angle = parseFloat(wall.style.transform.match(/rotate\(([-0-9.]+)deg\)/)?.[1] || '0');
                const x2 = x1 + width * Math.cos(angle * Math.PI / 180);
                const y2 = y1 + width * Math.sin(angle * Math.PI / 180);
                walls.push({ 
                    x1: x1 / baseScale, 
                    y1: y1 / baseScale, 
                    x2: x2 / baseScale, 
                    y2: y2 / baseScale 
                });
            }
        });

        // Сохраняем данные участников
        for (let i = 1; i < table.rows.length; i++) {
            const row = table.rows[i];
            const name = row.cells[1].innerText;
            data.push({
                category: row.cells[0].innerText,
                name: name,
                initiative: parseInt(row.cells[2].innerText) || 0,
                currentHp: row.cells[3].dataset.currentValue,
                maxHp: row.cells[3].dataset.maxValue,
                armorClass: row.cells[4].querySelector('.ac-circle').innerText,
                currentSteam: row.cells[5].dataset.currentValue,
                maxSteam: row.cells[5].dataset.maxValue,
                history: row.cells[6].innerText,
                position: characters[name] || { x: 0, y: 0 }
            });
        }

        const saveData = {
            combatData: data,
            currentTurnIndex: currentTurnIndex,
            roundCounter: roundCounter,
            zoomLevel: zoomLevel,
            translateX: translateX,
            translateY: translateY,
            walls: walls,
            timestamp: Date.now()
        };

        localStorage.setItem('combatState', JSON.stringify(saveData));
        console.log('Combat data saved successfully:', saveData);
    } catch (error) {
        console.error('Error saving combat data:', error);
    }
}

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

        // Восстанавливаем данных участников
        const data = state.combatData || [];
        data.forEach(participant => {
            const row = table.insertRow();
            row.classList.add('card', 'fade-in');
            row.insertCell().innerText = participant.category;
            row.insertCell().innerText = participant.name;
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
                removeCharacterFromBattlefield(participant.name);
                setTimeout(() => row.remove(), 300);
                saveCombatData();
            };
            actionCell.appendChild(deleteButton);
            
            // Добавляем персонажа на поле боя
            const pos = participant.position || { x: 0, y: 0 };
            addCharacterToBattlefield(participant.name, participant.category === 'Игрок' ? 'player' : 'enemy', pos.x * baseScale, pos.y * baseScale, participant);
            
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

// Функция броска кубика
function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const resultElement = document.getElementById('diceResult');
    
    // Анимация кнопки
    const button = event.target;
    button.style.transform = 'scale(0.95)';
    setTimeout(() => button.style.transform = '', 150);

    // Показываем результат
    resultElement.textContent = `d${sides}: ${result}`;
    resultElement.classList.add('show');
    
    // Воспроизводим звук броска
    playSound('button-click.mp3');

    // Скрываем результат через 3 секунды
    setTimeout(() => {
        resultElement.classList.remove('show');
    }, 3000);

    return result;
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
    
    // Проверяем, существует ли уже персонаж с таким именем
    const existingChar = Array.from(document.querySelectorAll('.character')).find(c => c.dataset.name === name);
    if (existingChar) {
        existingChar.remove(); // Удаляем существующий, чтобы создать новый
    }
    
    const char = document.createElement('div');
    char.classList.add('character');
    char.classList.add(type === 'player' ? 'player' : 'enemy');
    char.dataset.name = name;
    
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
        if (char.dataset.name === name) char.remove();
    });
}

// Добавляем функцию переключения отображения футов
function toggleFeetDisplay() {
    showFeetDistance = !showFeetDistance;
    const button = document.getElementById('toggle-feet');
    button.classList.toggle('active', showFeetDistance);
    
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
    
    const gridSize = 50;
    
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

        const rect = battlefield.getBoundingClientRect();

        if (isDrawingWall) {
            e.preventDefault();
            if (wallStartX === null && wallStartY === null) {
                if (e.target.classList.contains('wall-snap-point')) {
                    wallStartX = parseFloat(e.target.dataset.x);
                    wallStartY = parseFloat(e.target.dataset.y);
                } else {
                    // Получаем координаты мыши относительно окна
                    const mouseX = e.clientX;
                    const mouseY = e.clientY;

                    // Получаем координаты и трансформацию поля боя
                    const battlefieldRect = battlefield.getBoundingClientRect();
                    const battlefieldX = mouseX - battlefieldRect.left;
                    const battlefieldY = mouseY - battlefieldRect.top;

                    // Преобразуем координаты с учетом масштаба и смещения
                    wallStartX = (battlefieldX - translateX) / zoomLevel;
                    wallStartY = (battlefieldY - translateY) / zoomLevel;

                    // Привязка к сетке
                    const gridSize = 50;
                    wallStartX = Math.round(wallStartX / gridSize) * gridSize;
                    wallStartY = Math.round(wallStartY / gridSize) * gridSize;
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
            const battlefieldRect = battlefield.getBoundingClientRect();
            
            // Получаем текущие координаты мыши
            const mouseX = e.clientX - battlefieldRect.left;
            const mouseY = e.clientY - battlefieldRect.top;

            // Преобразуем координаты с учетом масштаба и смещения
            const currentX = (mouseX - translateX) / zoomLevel;
            const currentY = (mouseY - translateY) / zoomLevel;

            updateTempWall(wallStartX, wallStartY, currentX, currentY);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDraggingMap) {
            isDraggingMap = false;
            battlefieldContainer.style.cursor = isDrawingWall ? 'crosshair' : 'grab';
            saveCombatData();
        } else if (isDrawingWall && wallStartX !== null && wallStartY !== null) {
            const battlefieldRect = battlefield.getBoundingClientRect();
            
            // Получаем конечные координаты мыши
            const mouseX = e.clientX - battlefieldRect.left;
            const mouseY = e.clientY - battlefieldRect.top;

            // Преобразуем координаты с учетом масштаба и смещения
            const currentX = (mouseX - translateX) / zoomLevel;
            const currentY = (mouseY - translateY) / zoomLevel;

            const dx = currentX - wallStartX;
            const dy = currentY - wallStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 25) {
                const { snapX, snapY } = updateTempWall(wallStartX, wallStartY, currentX, currentY);
                drawWall(wallStartX, wallStartY, snapX, snapY);
            }

            const tempLine = battlefield.querySelector('.temp-wall');
            if (tempLine) tempLine.remove();

            wallStartX = null;
            wallStartY = null;
            saveCombatData();
        }
    });
}

function updateTempWall(startX, startY, currentX, currentY) {
    const battlefield = document.getElementById('battlefield');
    let tempLine = battlefield.querySelector('.temp-wall');
    
    if (!tempLine) {
        tempLine = document.createElement('div');
        tempLine.classList.add('wall-line', 'temp-wall');
        battlefield.appendChild(tempLine);
    }

    // Привязка к сетке
    const gridSize = 50;
    const snapX = Math.round(currentX / gridSize) * gridSize;
    const snapY = Math.round(currentY / gridSize) * gridSize;
    
    const dx = snapX - startX;
    const dy = snapY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    tempLine.style.left = startX + 'px';
    tempLine.style.top = startY + 'px';
    tempLine.style.width = length + 'px';
    tempLine.style.transform = `rotate(${angle}deg)`;

    return { snapX, snapY };
}

function drawWall(x1, y1, x2, y2) {
    const battlefield = document.getElementById('battlefield');
    const line = document.createElement('div');
    line.classList.add('wall-line');
    
    // Привязка к сетке
    const gridSize = 50;
    x1 = Math.round(x1 / gridSize) * gridSize;
    y1 = Math.round(y1 / gridSize) * gridSize;
    x2 = Math.round(x2 / gridSize) * gridSize;
    y2 = Math.round(y2 / gridSize) * gridSize;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    line.style.left = x1 + 'px';
    line.style.top = y1 + 'px';
    line.style.width = length + 'px';
    line.style.transform = `rotate(${angle}deg)`;

    // Добавляем точки привязки на концах стены
    const startPoint = document.createElement('div');
    startPoint.classList.add('wall-snap-point');
    startPoint.style.left = x1 + 'px';
    startPoint.style.top = y1 + 'px';
    startPoint.dataset.x = x1;
    startPoint.dataset.y = y1;

    const endPoint = document.createElement('div');
    endPoint.classList.add('wall-snap-point');
    endPoint.style.left = x2 + 'px';
    endPoint.style.top = y2 + 'px';
    endPoint.dataset.x = x2;
    endPoint.dataset.y = y2;

    line.addEventListener('dblclick', () => {
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

    battlefield.appendChild(line);
    battlefield.appendChild(startPoint);
    battlefield.appendChild(endPoint);

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