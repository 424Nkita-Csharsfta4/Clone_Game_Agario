// Socket/Express 
let express = require('express');
let socket = require('socket.io');
let app = express();
app.use(express.static('public'));
let server = app.listen(4000);
let io = socket(server);

// Текущие массивы игроков
let clients = [];
let players = [];
let scores = [];

io.on('connection', newConnection);


// Используется, чтобы не рисовать цель близко к краям
let margin = 20;

// Ближайшая цель, которая может появиться у любого игрока
let minGoalDist = 200;

//Размер всех игроков
let playerSize = 13;

//Размер холста
let width = 900,
	height = 900;

	let lastTime = 0,
	currentTime = 0;

//Данные игрока
function Player(id, name, color, px, py) {
	this.id = id;
	this.name = name;
	this.color = color;
	this.score = 0;
	this.x = px;
	this.y = py;
}

// Данные цели
let gx = 300,
	gy = 300;	
//
// Запускается, когда новый игрок входит в игру, перед вводом имени
// --Только добавляет в клиентский массив--
//
function newConnection(socket) {
	console.log("New Connection: " + socket.id);

	// Новый список ID в клиентах
	clients.push(socket.id);

	// Отправляем им идентификатор игроков
	socket.emit('id', {
		id: socket.id,
	});

	// Отправляем список текущих игроков для проверки конфликтов имен на стороне клиента
	socket.emit('initialPlayerData', {
		players: players,
	});

	socket.emit('goalData', {
		x: gx,
		y: gy,
	});

// Запускается, когда клиент отключается от сервера
	socket.on('disconnect', function () {

		// Удалить из клиентского массива
		let i = clients.indexOf(socket.id);
		clients.splice(i, 1);

		// Удалить из массива игроков
		i = players.map(function (e) {
			console.log(player)
			return e.id;
		}).indexOf(socket.id);
		if (i >= 0) {
			console.log("Removing player: " + players[i].name);
			io.emit('newMessage', {
				message: players[i].name + " has left the game"
			});
			players.splice(i, 1);
		} else {
			console.log("Got bad player index of " + i + " on removePlayer");
		}
	});


	// Запускается, когда имя получено от клиента
	socket.on('nameEntered', function (data) {
		players.push(new Player(data.id, data.name, data.color, data.x, data.y));
		console.log("Добавлен " + data.name + " в массив игроков с ID " + data.id);
		io.emit('newMessage', {
			message: data.name + " Присоединился к пати",
		});
	});


// Запускается всякий раз, когда от клиента поступает новая позиция
	socket.on('playerData', function (playerData) {
	// Получить индекс игрока
		let i = players.map(function (e) {
			return e.id;
		}).indexOf(playerData.id);

	// Убедитесь, что сгенерированный индекс действителен
		if (i >= 0) {
		// Обновить информацию об игроке в массиве player
			players[i].x = playerData.x;
			players[i].y = playerData.y;
		}
	});


	// Запускается, когда игрок сталкивается с целью
	socket.on('playerPoint', function (data) {

		gx = data.x;
		gy = data.y;

		// Получить индекс игрока
		let i = players.map(function (e) {
			return e.id;
		}).indexOf(data.id);

		if (i >= 0) {
			players[i].score++;
			sortPlayers();
		} else {
			console.log("Индекс плохого игрока" + i + " при увеличении точки");
		}

		io.emit('goalData', {
			x: gx,
			y: gy,
		});
	});


	// Runs when the player wants an update of the players array and goal positions
	socket.on('requestUpdate', function () {
		socket.emit('updatedPlayers', {
			players: players,
		});
	});
}


//
// Сортируем массив игроков по счету
//
function sortPlayers() {
	players.sort(function (a, b) {
		let val1 = a.score,
			val2 = b.score;
		if (val1 < val2) return 1;
		if (val1 > val2) return -1;
		return 0;
	});
}


//
// Рассчитать расстояние между точками, (x1, y1) и (x2, y2)
//
function distance(x1, y1, x2, y2) {
	let dist;
	dist = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
	return dist;
}
