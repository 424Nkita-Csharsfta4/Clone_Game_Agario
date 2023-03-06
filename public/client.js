// Инициализация переменной 
var canvas = document.querySelector("#roadeo");
canvas.width = canvas.height = 600;
var context = canvas.getContext('2d');
context.font = '1em Helvetica';

// Настройка сокетов
var socket = io.connect(document.location.href);

// Получаем наш ID с сервера
socket.on('id', function (data) {
  playerID = data.id;
});

// Получить список имен, чтобы мы знали, является ли наше имя законным
socket.on('initialPlayerData', function (players) {
  for (var i = 0; i < players.players.length; i++) {
    nameList.push(players.players[i].name);
  }
});

// При получении новых данных о цели
socket.on('goalData', function (data) {
  gx = data.x;
  gy = data.y;
});

// При получении данных о новом игроке
socket.on('updatedPlayers', function (data) {
  players = data.players;
});

// При получении нового сообщения
socket.on('newMessage', function (data) {
  messages.unshift(data.message);
});

// Переменные, меняющие правила игры
let maxSpeed = 5;
let force = 2;
let friction = 0.97;
let wallBounce = -0.7; // -1 сохраняет всю скорость

// Переменные игрока
let playerColor = getRandomColor();
let playerID;
let name = '';
let players = [];
let nameList = [];
let messages = [];
let playerSize = 13;
let px = 100,
  py = 100;
let vx = 0,
  vy = 0;

// Целевые переменные
let gx, gy;
let goalColor = '#FFDF00';
let goalOutlineColor = '#D4AF37';
let goalSize = 20;
let margin = 20;
let minGoalDist = 200;

// Переменные данных
let keys = [];

// Переменные соска
let rad = 0;
let mag = 0;

//
// Получить имя игрока
//
function nameEnter() {
  name = document.getElementById('username').value;
  if (!name) {
    alert("Please enter a name");
  } else if (document.getElementById('username').value.length > 11) {
    alert("Пожалуйста, введите имя длиной менее 10 символов");
    name = '';
  } else if (nameList.includes(document.getElementById('username').value)) {
    alert("Пользователь с таким именем уже существует");
    name = '';
  } else {
    name = document.getElementById('username').value;
    $('#nameModal').modal('hide');

    // Send server basic player info when name is set
    socket.emit('nameEntered', {
      id: playerID,
      name: name,
      color: playerColor,
      x: px,
      y: py,
    });
  }
}

// Обработка нажатия ввода в текстовом поле
document.getElementById('username').onkeypress = function (e) {
  if (!e) e = window.event;
  var keyCode = e.keyCode || e.which;
  if (keyCode == '13')
    nameEnter();
}


//
// Слушаем нажатия/отпускания клавиш
//
window.addEventListener("keydown", keysPressed, false);
window.addEventListener("keyup", keysReleased, false);

gameLoop();


//
// Основной игровой цикл, в котором вызываются функции
//
function gameLoop() {

  requestAnimationFrame(gameLoop);
  clearCanvas();


  if (name) {
    // Проверяем, мобильный ли
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
      getNip();
    }

    // обновить скорость игрока
    updateVelocities();

    // обновляет значения игроков
    movePlayer();

    // Отправляем данные игрока на сервер
    socket.emit('playerData', {
      id: playerID,
      x: px,
      y: py,
    });
  }

  checkCollisions();
  socket.emit('requestUpdate', {});

  drawGoal();
  drawAllPlayers();
  drawScoreboard();
  drawMessages();
}


//
// движение сосков
//
function getNip() {
  manager.on('move dir', function (evt, nip) {
    rad = nip.angle.radian;
    if ((nip.force / 8) > 1)
      mag = 1;
    else
      mag = (nip.force / 8);
  });

  manager.on('end', function (evt, nip) {
    mag = 0;
  });
}


//
// Новое обновление движения: расчет силы на основе активного джойстика/нажатий клавиш
//
function updateVelocities() {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    let forceX = mag * Math.cos(rad);
    let forceY = mag * Math.sin(rad);

    if (forceX > 1)
      forceX = 1;
    else if (forceX < -1)
      forceX = -1;

    if (forceY > 1)
      forceY = 1;
    else if (forceY < -1)
      forceY = -1;

    if (hypot(vx, vy) < maxSpeed) {
      vx += forceX;
      vy -= forceY;
    }
  } else {
    // ←
    if (keys[37] || keys[65]) {
      if (vx > -maxSpeed)
        vx -= 1;
    }

    // ↑
    if (keys[38] || keys[87]) {
      if (vy > -maxSpeed)
        vy -= 1;
    }

    // →
    if (keys[39] || keys[68]) {
      if (vx < maxSpeed)
        vx += 1;

    }

    // ↓
    if (keys[40] || keys[83]) {
      if (vy < maxSpeed)
        vy += 1;
    }
  }
}


//
// Вычисляет новую позицию игрока
//
function movePlayer() {
  // Применяем трение, чтобы замедлить работу очень красиво
  vy *= friction;
  vx *= friction;

  // Bounds checking

  // Если игрок касается правой или левой стены
  if (px > (canvas.width - playerSize)) {
    px = canvas.width - playerSize;
    vx *= wallBounce;
  } else if (px < (0 + playerSize)) {
    px = playerSize;
    vx *= wallBounce;
  }

  // Если игрок касается нижней или верхней стены
  if (py > (canvas.height - playerSize)) {
    py = canvas.height - playerSize;
    vy *= wallBounce;
  } else if (py < (0 + playerSize)) {
    py = playerSize;
    vy *= wallBounce;
  }

  // Изменить позицию
  px += vx;
  py += vy;
}


//
// Проверяем, сталкивается ли игрок с целью
//

function checkCollisions() {
  // Проверка на столкновение
  if (distance(gx, gy, px, py) < (goalSize + playerSize)) {
    // Отправляем массив новых игроков клиенту для обновления результатов
    resetGoal();
    socket.emit('playerPoint', {
      id: playerID,
      x: gx,
      y: gy,
    });
  }
}


//
// Рисует целевую монету и проверяет, находится ли в ней игрок
//
function drawGoal() {
  // Сбросить непрозрачность на всякий случай
  context.globalOpacity = 1.0;

  // Цветная часть в центре
  context.beginPath();
  context.arc(gx, gy, goalSize, 0, 2 * Math.PI);
  context.fillStyle = goalColor;
  context.fill();

  // Контур немного не в цвете
  context.beginPath();
  context.arc(gx, gy, goalSize, 0, 2 * Math.PI);
  context.strokeStyle = goalOutlineColor;
  context.lineWidth = 2;
  context.stroke();
}


//
// Отрисовывает всех игроков на экране, вызывает другие функции отрисовки
//
function drawAllPlayers() {
  var x, y, color;

  for (var i = 0; i < players.length; i++) {
    // Временные переменные для удобства чтения
    x = players[i].x;
    y = players[i].y;
    color = players[i].color;

    // Если это не я, то сделать их немного прозрачными
    if (name != players[i].name)
      context.globalAlpha = 0.5;
    else {
      context.globalAlpha = 1.0;
      x = px;
      y = py;
    }
    // Цветная часть в центре
    context.beginPath();
    context.arc(x, y, playerSize, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();

    // Цветная часть в центре
    context.beginPath();
    context.arc(x, y, playerSize, 0, 2 * Math.PI);
    context.strokeStyle = "#000";
    context.lineWidth = 2;
    context.stroke();

    // Имя игрока
    context.fillStyle = "#1e1e1e";
    context.fillText(players[i].name, x - 20, y - 20);

    // Сброс непрозрачности
    context.globalAlpha = 1.0;

    if (!nameList.includes(players[i].name))
      nameList.push(players[i].name);

  }
}


//
// Отображает имена игроков и очки в правом верхнем углу
//
function drawScoreboard() {

  // Заголовок
  context.fillStyle = "#000";
  context.fillText("Player", 10, 20);
  context.fillText("Score", 110, 20);
  context.fillText("- - - - - - - - - - - - - - -", 10, 30);

  // Приращение для каждого игрока, помещая каждого под последним
  let offset = 0;

  // Cycle through players, draw name and score
  for (var i = 0; i < players.length; i++) {
    context.fillText(players[i].name, 10, 50 + offset);
    context.fillText(players[i].score, 110, 50 + offset);
    offset += 20;
  }

  // Статистика отладки
  context.fillText("vx: " + vx, 200, 20);
  context.fillText("vy: " + vy, 200, 40);

  context.fillText("rad: " + rad, 200, 70);
  context.fillText("mag: " + mag, 200, 90);
}


//
// Распечатывает обновления игры в левом нижнем углу
//
function drawMessages() {

  // Сброс непрозрачности и смещения позиции
  context.globalAlpha = 1;
  let offset = 0;

  // Прокручиваем сообщения, печатаем с разным смещением и непрозрачностью
  for (var i = 0; i < messages.length; i++) {
    if (messages[i]) {
      context.globalAlpha = messages[i].opacity;
      context.fillText(messages[i], 10, 580 - offset);
      offset += 20;
      context.globalAlpha -= 0.2;
    } else break;
  }
  context.globalAlpha = 1;
}


//
// Увеличивает позицию при нажатии клавиши, обрабатывает несколько нажатий клавиш
// и поддержка WASD, а также клавиш со стрелками
//

function keysPressed(e) {
  // Возможность двигаться, только если есть имя
  if (name) {
    // Сохраняем запись, если нажата клавиша
    keys[e.keyCode] = true;
  }
}





//
// Устанавливаем значение false в массиве ключей, если отпущено
//
function keysReleased(e) {
  keys[e.keyCode] = false;
}


//
// Создать случайное 6-значное шестнадцатеричное значение
//
function getRandomColor() {
  let digits = '0123456789ABCDEF';
  let color = '#';

  for (var i = 0; i < 6; i++) {
    color += digits[Math.floor(Math.random() * 16)];
  }
  return color;
}


//
// Сбрасывает позицию и размер цели
//
function resetGoal() {
  gPos = getGoalPosition();
  gx = gPos[0], gy = gPos[1];
}

//
// Установить новую позицию цели, минимум 200 от любого игрока
//
function getGoalPosition() {
  // Если никто не играет, не проверять по игрокам
  if (players.length == 0) return [300, 300];
  else {
    var x, y;
    var good = false;
    do {
      for (var i = 0; i < players.length; i++) {
        x = (Math.random() * (canvas.width - (2 * margin))) + margin;
        y = (Math.random() * (canvas.height - (2 * margin))) + margin;
        dist = distance(x, y, players[i].x, players[i].y);
        if (dist > minGoalDist)
          good = true;
        else
          good = false;
      }
    } while (!good);

    return [x, y];
  }
}

//
// Рассчитать расстояние между точками, (x1, y1) и (x2, y2)
//
function distance(x1, y1, x2, y2) {
  var dist;
  dist = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
  return dist;
}


//
// Калькулятор гипотенузы
//
function hypot(w, h) {
  return Math.sqrt((w * w) + (h * h));
}

//
// Довольно понятно
//
function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}
