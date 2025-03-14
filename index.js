function playSound(soundFile) {
  const audio = new Audio(`sounds/${soundFile}`);
  audio.play().catch(error => console.log("Ошибка воспроизведения звука:", error));
}

function addRow(tableId) {
  const table = document.getElementById(tableId);
  const row = table.insertRow();
  row.classList.add('card', 'fade-in');
  const nameCell = row.insertCell();
  const maxHpCell = row.insertCell();
  const acCell = row.insertCell();
  const steamChargesCell = row.insertCell(); // Новый столбец
  const inventoryCell = row.insertCell();
  const actionCell = row.insertCell();

  nameCell.contentEditable = true;
  maxHpCell.contentEditable = true;
  acCell.contentEditable = true;
  steamChargesCell.contentEditable = true; // Новый столбец редактируемый
  inventoryCell.contentEditable = true;

  const deleteButton = document.createElement('button');
  deleteButton.innerHTML = '<i class="fas fa-trash"></i> Удалить';
  deleteButton.onclick = () => {
    playSound('delete.mp3');
    row.classList.add('fade-out');
    setTimeout(() => row.remove(), 300);
    saveData();
  };
  actionCell.appendChild(deleteButton);

  saveData();
}

function saveData() {
  const tables = ['pcs-table', 'monsters-table'];
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    const data = [];
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const rowData = [];
      for (let j = 0; j < row.cells.length - 1; j++) {
        rowData.push(row.cells[j].innerText);
      }
      data.push(rowData);
    }
    localStorage.setItem(tableId, JSON.stringify(data));
  });
  
  // Сохраняем текущее значение золота
  const goldAmount = document.getElementById('gold-amount').innerText;
  localStorage.setItem('gold-amount', goldAmount);
}

// Функция для обновления количества золота
function updateGold() {
  const goldInput = document.getElementById('gold-input');
  const goldAmount = document.getElementById('gold-amount');
  
  let currentGold = parseInt(goldAmount.innerText) || 0;
  const inputValue = goldInput.value.trim();
  
  if (inputValue === '') return;
  
  if (inputValue.startsWith('+')) {
    // Если ввод начинается с +, добавляем значение
    const addValue = parseInt(inputValue.substring(1));
    if (!isNaN(addValue)) {
      currentGold += addValue;
    }
  } else if (inputValue.startsWith('-')) {
    // Если ввод начинается с -, вычитаем значение
    const subValue = parseInt(inputValue.substring(1));
    if (!isNaN(subValue)) {
      currentGold -= subValue;
    }
  } else {
    // Если это просто число, заменяем текущее значение
    const newValue = parseInt(inputValue);
    if (!isNaN(newValue)) {
      currentGold = newValue;
    }
  }
  
  // Обновляем отображение и сохраняем
  goldAmount.innerText = currentGold;
  goldInput.value = '';
  saveData();
  
  // Анимация изменения
  const goldDisplay = document.querySelector('.gold-display');
  goldDisplay.classList.add('gold-updated');
  setTimeout(() => {
    goldDisplay.classList.remove('gold-updated');
  }, 500);
}

// Обработка нажатия Enter в поле ввода золота
document.addEventListener('DOMContentLoaded', function() {
  const goldInput = document.getElementById('gold-input');
  goldInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      updateGold();
      playSound('coin-sound.mp3');
    }
  });
  
  // Инициализация данных при загрузке страницы
  loadData();
});

function loadData() {
  ['pcs-table', 'monsters-table'].forEach(tableId => {
    const table = document.getElementById(tableId);
    const savedData = JSON.parse(localStorage.getItem(tableId) || '[]');
    savedData.forEach(rowData => {
      const row = table.insertRow();
      row.classList.add('card', 'fade-in');
      const nameCell = row.insertCell();
      const maxHpCell = row.insertCell();
      const acCell = row.insertCell();
      const steamChargesCell = row.insertCell(); // Новый столбец
      const inventoryCell = row.insertCell();
      const actionCell = row.insertCell();

      nameCell.innerText = rowData[0] || '';
      maxHpCell.innerText = rowData[1] || '';
      acCell.innerText = rowData[2] || '';
      steamChargesCell.innerText = rowData[3] || ''; // Загружаем данные
      inventoryCell.innerText = rowData[4] || '';

      nameCell.contentEditable = true;
      maxHpCell.contentEditable = true;
      acCell.contentEditable = true;
      steamChargesCell.contentEditable = true; // Новый столбец редактируемый
      inventoryCell.contentEditable = true;

      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = '<i class="fas fa-trash"></i> Удалить';
      deleteButton.onclick = () => {
        playSound('delete.mp3');
        row.classList.add('fade-out');
        setTimeout(() => row.remove(), 300);
        saveData();
      };
      actionCell.appendChild(deleteButton);
    });
  });

  document.querySelectorAll('td[contenteditable]').forEach(cell => {
    cell.addEventListener('input', saveData);
  });
  
  // Загружаем сохраненное значение золота
  const savedGold = localStorage.getItem('gold-amount');
  if (savedGold !== null) {
    document.getElementById('gold-amount').innerText = savedGold;
  }
}

// Добавляем обработчик перед выходом для сохранения данных
window.addEventListener('beforeunload', saveData); 