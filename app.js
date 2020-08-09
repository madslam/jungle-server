var createError = require ('http-errors');
var express = require ('express');
var path = require ('path');
var cookieParser = require ('cookie-parser');
var logger = require ('morgan');

var app = express ();

// view engine setup
app.set ('views', path.join (__dirname, 'views'));
app.set ('view engine', 'jade');

app.use (logger ('dev'));
app.use (express.json ());
app.use (express.urlencoded ({extended: false}));
app.use (cookieParser ());
app.use (express.static (path.join (__dirname, 'public')));

// catch 404 and forward to error handler
app.use (function (req, res, next) {
  next (createError (404));
});

// error handler
app.use (function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get ('env') === 'development' ? err : {};

  // render the error page
  res.status (err.status || 500);
  res.render ('error');
});

var server = require ('http').Server (app);
var socketio = require ('socket.io');
const io = socketio (server);
const players = [];
const gameCards = [
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  6,
  6,
  6,
  6,
  7,
  7,
  7,
  7,
  8,
  8,
  8,
  8,
  9,
  9,
  9,
  9,
  10,
  10,
  10,
  10,
  11,
  11,
  11,
  11,
  12,
  12,
  12,
  12,
  13,
  13,
  13,
  13,
  14,
  14,
  14,
  14,
  15,
  15,
  15,
  15,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
];
class Game {
  constructor({id}) {
    this.id = id;
    this.players = [];
    this.width = 1100;
    this.height = 800;
    this.gameCards = [...gameCards];
    this.round = 0;
    this.start = false;
    this.stop = false;
    this.message = '';
    this.totem = new Totem ({
      position: {x: this.width / 2, y: this.height / 2},
    });
  }
  addPlayer (id) {
    const type = this.players.length + 1;
    const goal = new Goal ({type, isPlaying: false});
    const deck = new Deck ();
    if (type === 1) {
      goal.position = {
        x: this.width / 2,
        y: this.height - this.height / 8,
      };
      deck.positionBunch = {
        x: this.width / 2,
        y: this.height - this.height / 4,
      };

      deck.healthBarPosition = {
        x: this.width / 2,
        y: this.height - this.height / 40,
      };
    }
    if (type === 2) {
      goal.position = {
        x: this.width / 2,
        y: this.height / 8,
      };
      deck.positionBunch = {
        x: this.width / 2,
        y: this.height / 4,
      };
      deck.healthBarPosition = {
        x: this.width / 2,
        y: this.height / 40,
      };
    }
    const player = new Player ({
      id,
      type,
      goal,
      deck,
    });
    this.players.push (player);
    return player;
  }

  distributeCards () {
    const cardsByPlayer = this.gameCards.length / this.players.length;
    this.players.forEach (player => {
      const deckPlayer = [];
      for (let x = 0; x < cardsByPlayer; x++) {
        const random = Math.random () * this.gameCards.length;
        const value = this.gameCards.splice (random, 1)[0];

        const num = Math.floor (Math.random () * 8) + 1; // this will get a number between 1 and 99;
        const rotation = num * (Math.floor (Math.random () * 2) == 1 ? 1 : -1);
        const newCard = new Card ({
          move: false,
          position: null,
          value,
          rotation,
        });
        deckPlayer.push (newCard);
      }
      player.setDeckCards (deckPlayer);
    });
  }
  startGame () {
    this.distributeCards ();
    this.round = 1;
    this.players[this.round - 1].isPlaying = true;
    this.start = true;
  }
  isGameFinish () {
    const playersWin = this.players.reduce ((winners, p) => {
      if (p.deck.cards.length === 0 && p.deck.bunchCards.length === 0) {
        return [...winners, p];
      }
      return winners;
    }, []);
    return playersWin;
  }
  nextRound () {
    const newRound = this.round + 1 > this.players.length ? 1 : this.round + 1;

    const nextPlayer = this.players[newRound - 1];

    if (nextPlayer.deck.cards.length > 0) {
      const currentPlayer = this.players[this.round - 1];
      currentPlayer.isPlaying = false;
      this.round = newRound;

      nextPlayer.isPlaying = true;
      return nextPlayer;
    } else {
      this.round = newRound;
      this.nextRound ();
    }
  }
}
class Card {
  constructor({position, move, value, rotation}) {
    this.position = position;
    this.move = move;
    this.radius = 80;
    this.value = value;
    this.rotation = rotation;
  }
}

class Player {
  constructor({id, type, deck, goal}) {
    this.position = {
      x: Math.floor (Math.random () * 1000),
      y: Math.floor (Math.random () * 1000),
    };
    this.deck = deck;
    this.type = type;
    this.radius = 5;
    this.id = id;
    this.click = false;
    this.isPlaying = false;
    this.goal = goal;
    this.timer = 0;
    this.drawCard = new Card ({position: null, move: false, value: null});
  }
  setPosition (position) {
    this.position = position;
  }
  setClick (click) {
    this.click = click;
  }
  setDeckCards (cards) {
    this.deck.addCards (cards);
  }
  getFirstCard () {
    return this.deck.cards[this.deck.cards.length - 1];
  }
  setBunchCard (bunchCards) {
    this.bunchCards = bunchCards;
  }
}
class Deck {
  constructor () {
    this.radius = 80;
    this.positionBunch = null;
    this.cards = [];
    this.bunchCards = [];
    this.cardPlayed = new Card ({value: null});
    this.healthBarPosition = null;
    this.healthBarValue = 0;
  }

  popCards () {
    const card = this.cards.pop ();
    card.position = this.positionBunch;
    this.bunchCards.push (card);
    this.cardPlayed = card;
    this.healthBarValue = this.cards.length / gameCards.length * 100;
  }
  cleanBunch () {
    const cards = this.bunchCards;
    this.bunchCards = [];
    this.cardPlayed = new Card ({value: null});
    return cards;
  }
  setBunch (playerWinBunchCards) {
    this.cards = [...this.bunchCards, ...playerWinBunchCards, ...this.cards];
    this.bunchCards = [];
    this.cardPlayed = new Card ({value: null});
  }
  addCards (newCards) {
    this.cards = [...newCards, ...this.cards];
    this.healthBarValue = this.cards.length / gameCards.length * 100;
  }
}
class Goal {
  constructor({type, isPlaying, position}) {
    this.position = position;
    this.type = type;
    this.radius = 50;
    this.isPlaying = isPlaying;
    this.totemIn = false;
    this.timer = 0;
  }
  setTotemIn (totemIn) {
    this.totemIn = totemIn;
  }
}
class Totem {
  constructor({position, playerMove}) {
    this.position = position;
    this.radius = 40;
    this.playerMove = playerMove;
  }
  setPosition (position) {
    this.position = position;
  }
  setPlayerMove (playerMove) {
    this.playerMove = playerMove;
  }
}

const checkCollision = (obj1, obj2) => {
  var vx = obj1.position.x - obj2.position.x;
  var vy = obj1.position.y - obj2.position.y;
  var length = Math.sqrt (vx * vx + vy * vy);

  if (length < obj1.radius + obj2.radius) {
    return true;
  }
  return false;
};
const searchPlayer = (id, game) => {
  let i = null;
  game.players.forEach (function (player, index) {
    if (player.id === id) {
      i = index;
    }
  });
  return {player: game.players[i], index: i};
};

function easeOutBounce (t, b, c, d) {
  if ((t /= d) < 1 / 2.75) {
    return c * (7.5625 * t * t) + b;
  } else if (t < 2 / 2.75) {
    return c * (7.5625 * (t -= 1.5 / 2.75) * t + 0.75) + b;
  } else if (t < 2.5 / 2.75) {
    return c * (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375) + b;
  } else {
    return c * (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375) + b;
  }
}

const objectReturn = (
  object,
  basePosition,
  duration = 100,
  callback,
  callbackEnd = () => {}
) => {
  let time = 0;

  const timer = setInterval (function () {
    time = time + 1;
    let elapsed = time;
    if (elapsed > duration) {
      elapsed = duration;
    }

    var x = easeOutBounce (
      elapsed,
      object.position.x,
      basePosition.x - object.position.x,
      duration
    );
    var y = easeOutBounce (
      elapsed,
      object.position.y,
      basePosition.y - object.position.y,
      duration
    );
    const objectPosition = {
      x: Math.round (x * 100) / 100,
      y: Math.round (y * 100) / 100,
    };
    object.position = objectPosition;
    if (
      Math.round (object.position.x) === basePosition.x &&
      Math.round (object.position.y) === basePosition.y
    ) {
      clearInterval (timer);
      time = 0;
      callbackEnd ();
      return;
    }

    callback ();
  }, 10);
  return timer;
};

/*
const roundPlayer = (socket, player, game) => {
  let timePlayer = 0;

  playerIntervalId = setInterval (function () {
    timePlayer = timePlayer + 1;
    if (timePlayer > 62) {
      timePlayer = 0;
      const nextPlayer = game.nextRound ();
      clearInterval (playerIntervalId);
      roundPlayer (socket, nextPlayer, game);
      return;
    }

    player.timer = timePlayer / 10;
    socket.emit ('update', game);
  }, 100);
};*/

const rooms = [{name: 'room1', players: []}, {name: 'room2', players: []}];
io.sockets.on ('connection', function (socket) {
  console.log ('nouvelle connexion');
  const room = rooms.find (r => r.players.length < 2);

  if (!room) {
    console.log ('pas de room de dispo');
    io.to (socket.id).emit ('gameFull');
  } else {
    if (!room.game) {
      room.game = new Game ({id: socket.id});
      room.name = 'room' + socket.id;
      room.game.message = 'waiting for opponent 1/2';
      io.to (room.name).emit ('gameInit', {game: room.game});
    }
    const {game} = room;

    socket.join (room.name);
    room.players = [...room.players, 1];

    const player = game.addPlayer (socket.id);
    game.message = 'waiting for opponent 1/2';
    socket.emit ('gameInit', {player, game});
    if (game.players.length === 2) {
      game.message = ' the game is going to start in few second 2/2';
      io.to (room.name).emit ('gameWillStart', game);

      setTimeout (() => {
        game.startGame ();

        io.to (room.name).emit ('gameStart', game);
        io.to (room.name).emit ('update', {...game, deck: true});
      }, 4000);
    }
  }

  socket.on ('mouse', function({x, y}) {
    const roomName = Object.keys (socket.rooms)[1];
    const room = rooms.find (r => r.name === roomName);
    const game = room.game;
    //console.log (room, game);

    const {player} = searchPlayer (socket.id, game);
    const totem = game.totem;
    const checkMoveTotem = checkCollision (player, totem);
    // check if totem move by player
    if (checkMoveTotem && player.click && !player.drawCard.move) {
      const totemPosition = {
        x: totem.position.x - (player.position.x - x),
        y: totem.position.y - (player.position.y - y),
      };
      totem.setPosition (totemPosition);
      totem.setPlayerMove (player);

      const checkTotemGoal = checkCollision (totem, player.goal);
      if (checkTotemGoal && player.deck.cardPlayed != null && !game.stop) {
        const playerLost = game.players.find (
          p =>
            p.id !== player.id &&
            (p.deck.cardPlayed.value !== null &&
              player.deck.cardPlayed.value !== null) &&
            p.deck.cardPlayed.value === player.deck.cardPlayed.value
        );
        //player win a round
        if (playerLost) {
          io.to (roomName).emit ('animation', {
            players: game.players,
            position: playerLost.goal.position,
          });
          game.stop = true;
          game.players.forEach (p => {
            p.isPlaying = false;
          });
          const cardsForLooser = [
            ...player.deck.bunchCards,
            ...playerLost.deck.bunchCards,
          ];
          player.deck.cleanBunch ();
          playerLost.deck.cleanBunch ();
          playerLost.deck.addCards (cardsForLooser);

          const playersWin = game.isGameFinish ();
          if (playersWin.length > 0) {
            io.to (roomName).emit ('gameFinish', {playersWin});
          } else {
            const message = `player${playerLost.type} +${cardsForLooser.length} card noob`;
            const time = 4000;
            io.to (roomName).emit ('message', {message, time});
            game.round = playerLost.type;
            playerLost.isPlaying = true;
          }
          setTimeout (() => {
            game.stop = false;
            io
              .to (roomName)
              .emit ('update', {...game, bunchCards: true, deck: true});
          }, 2000);
        }
      } else {
        player.goal.setTotemIn (false);
      }
      io.to (roomName).emit ('update', {totem: game.totem});
    }
    let drawCard = null;
    //someone moove a card
    if (player.drawCard.move && player.click) {
      player.drawCard.position = {x, y};
      player.drawCard.rotation = player.getFirstCard ().rotation;
      io.to (roomName).emit ('update', {card: true, players: game.players});
    }
    player.setPosition ({x, y});
    io.to (roomName).emit ('update', {players: game.players});
  });
  socket.on ('mouseDown', data => {
    const roomName = Object.keys (socket.rooms)[1];
    const room = rooms.find (r => r.name === roomName);
    const game = room.game;

    const {player} = searchPlayer (socket.id, game);
    const click = {
      position: data,
      radius: 1,
    };
    player.setClick (true);

    const checkDrawCard = checkCollision (player.goal, click);
    //someone take a card
    if (checkDrawCard && player.deck.cards.length > 0) {
      player.drawCard = new Card ({position: data, move: true});
      io.to (roomName).emit ('update', {players, card: true});
    } else {
      const checkMoveTotem = checkCollision (player, game.totem);
      if (checkMoveTotem && !game.stop) {
        const playerSameCard = game.players.find (
          p =>
            p.id !== player.id &&
            p.deck.cardPlayed.value === player.deck.cardPlayed.value
        );
        // someone get totem without the same card with other player
        if (!playerSameCard) {
          const bunchCards = game.players.reduce ((cards, p) => {
            return [...cards, ...p.deck.bunchCards];
          }, []);
          game.players.forEach (p => {
            p.isPlaying = false;
          });
          game.stop = true;
          io.to (roomName).emit ('animation', {
            players: game.players,
            position: player.goal.position,
          });
          game.players.forEach (p => {
            p.deck.cleanBunch ();
          });
          const time = 4000;
          player.deck.addCards (bunchCards);

          const playersWin = game.isGameFinish ();

          if (playersWin.length > 0) {
            io.to (roomName).emit ('gameFinish', {playersWin});
          } else {
            const message = `player${player.type} +${bunchCards.length} card noob`;
            io.to (roomName).emit ('message', {message, time});
            game.round = player.type;
            player.isPlaying = true;
            player.timer = 0;
            timePlayer = 0;
          }
          setTimeout (() => {
            game.stop = false;
            io
              .to (roomName)
              .emit ('update', {...game, bunchCards: true, deck: true});
          }, 2000);
        }
      }
      io.to (roomName).emit ('update', {players: game.players});
    }
  });
  socket.on ('mouseUp', () => {
    const roomName = Object.keys (socket.rooms)[1];
    const room = rooms.find (r => r.name === roomName);
    const game = room.game;

    const {player} = searchPlayer (socket.id, game);
    const totem = game.totem;

    // someone drop a card
    if (player.drawCard.move) {
      player.drawCard.move = false;
      let basePosition = player.goal.position;
      const positionBunch = {
        position: {
          ...player.deck.positionBunch,
        },
        radius: 80,
      };
      const checkDropCard = checkCollision (positionBunch, player.drawCard);
      // card go to goal
      if (checkDropCard && player.isPlaying === true && !game.stop) {
        game.stop = true;
        io.to (roomName).emit ('animation2', {
          players: game.players,
          player,
          position: positionBunch.position,
        });
        game.nextRound ();
        player.deck.popCards (positionBunch.position);
        player.drawCard.position = null;
        basePosition = positionBunch;

        setTimeout (() => {
          game.stop = false;
          io.to (roomName).emit ('update', {
            players: game.players,
            deck: player.deck,
            bunchCards: true,
            card: true,
          });
        }, 1000);
      } else {
        //card return deck
        io.to (roomName).emit ('animation2', {
          players: game.players,
          player,
          position: basePosition,
        });
        player.drawCard.position = basePosition;

        setTimeout (() => {
          io.to (roomName).emit ('update', {
            players: game.players,
            card: true,
          });
        }, 900);
      }
    }
    // totem return origin
    if (totem.playerMove) {
      if (player.id === totem.playerMove.id) {
        totem.setPlayerMove (null);
        const {width, height} = game;
        const basePosition = {
          x: width / 2,
          y: height / 2,
        };
        const intervalId = objectReturn (totem, basePosition, 300, () =>
          io.to (roomName).emit ('update', {totem})
        );
        totem.intervalId = () => clearInterval (intervalId);
      }
    }
    player.setClick (false);

    io.to (roomName).emit ('update', game);
  });
  socket.on ('disconnect', () => {
    const roomName = Object.keys (socket.rooms)[1];
    const room = rooms.find (r => r.name === roomName);
    const game = room.game;

    const newGame = new Game ({id: null});
    console.log ('disco ?');

    if (game.players.length > 1) {
      console.log ('un joueur ce deco');
      const time = 3000;
      io.to (roomName).emit ('gameStop');
      const {index} = searchPlayer (socket.id, game);
      game.players.splice (index, 1);
      const player = newGame.addPlayer (game.players[0].id);
      newGame.message = 'someone leave the game, waiting for opponent 1/2';
      setTimeout (
        () => io.to (roomName).emit ('gameInit', {player, newGame}),
        3000
      );
    }
    game = newGame;
  });
});
module.exports = {app: app, server: server};
