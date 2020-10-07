var createError = require ('http-errors');
var express = require ('express');
var path = require ('path');
var cookieParser = require ('cookie-parser');
var logger = require ('morgan');
var reload = require ('express-reload');

var app = express ();

const admin = require ('firebase-admin');

const serviceAccount = require ('./jungle-speed-4f194-0598663160d6');
var path = __dirname + '/app.js';

app.use (reload (path));

admin.initializeApp ({
  credential: admin.credential.cert (serviceAccount),
});

const db = admin.firestore ();

app.use (logger ('dev'));
app.use (express.json ());
app.use (express.urlencoded ({extended: false}));
app.use (cookieParser ());

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
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
];
class Game {
  constructor({id}) {
    this.id = id;
    this.players = [];
    this.width = 900;
    this.height = 900;
    this.gameCards = [...gameCards];
    this.isAlive = false;
    this.round = 0;
    this.start = false;
    this.stop = false;
    this.message = '';
    this.totem = new Totem ({
      position: {x: this.width / 2, y: this.height / 2},
    });
  }
  findPlayer (type) {
    return this.players.find (p => p.type === type);
  }
  addPlayer (id) {
    this.isAlive = true;
    const type = this.players.length + 1;
    const goal = new Goal ({type, isPlaying: false});
    const deck = new Deck ();
    const profile = new Profile ({name: 'player ' + type});
    if (type === 1) {
      goal.position = {
        x: this.width / 2,
        y: this.height - this.height / 8,
      };
      profile.position = {
        x: this.width / 3,
        y: this.height - this.height / 8,
      };
      deck.positionBunch = {
        x: this.width / 2,
        y: this.height - this.height / 4,
      };
    }
    if (type === 2) {
      goal.position = {
        x: this.width / 2,
        y: this.height / 8,
      };
      profile.position = {
        x: this.width - this.width / 3,
        y: this.height / 8,
      };
      deck.positionBunch = {
        x: this.width / 2,
        y: this.height / 4,
      };
    }
    if (type === 3) {
      goal.position = {
        x: this.width / 8,
        y: this.height / 2,
      };
      profile.position = {
        x: this.width / 8,
        y: this.height / 3,
      };
      deck.positionBunch = {
        x: this.width / 4,
        y: this.height / 2,
      };
    }
    if (type === 4) {
      goal.position = {
        x: this.width - this.width / 8,
        y: this.height / 2,
      };
      profile.position = {
        x: this.width - this.width / 8,
        y: this.height - this.height / 3,
      };
      deck.positionBunch = {
        x: this.width - this.width / 4,
        y: this.height / 2,
      };
    }
    const player = new Player ({
      id,
      type,
      goal,
      deck,
      profile,
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
          position: player.goal.position,
          show: false,
          value,
          rotation,
        });
        deckPlayer.push (newCard);
      }
      player.addCards (deckPlayer);
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

    if (nextPlayer.deck.cards.length > 0 && nextPlayer.profile.isAlive) {
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
  constructor({position, move, value, rotation, show}) {
    this.position = position;
    this.move = move;
    this.radius = 80;
    this.show = show;
    this.value = value;
    this.rotation = rotation;
  }
}
class Profile {
  constructor({position, name}) {
    this.position = position;
    this.name = name;
    this.radius = 30;
    this.healt = 0;
    this.isAlive = true;
  }
}
class Player {
  constructor({id, type, deck, goal, profile}) {
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
    this.profile = profile;
    this.timer = 0;
    this.drawCard = new Card ({
      position: null,
      show: false,
      move: false,
      value: null,
    });
  }
  setPosition (position) {
    this.position = position;
  }
  setClick (click) {
    this.click = click;
  }

  getDrawCard () {
    if (!this.drawCard.position) {
      this.drawCard = this.deck.getFirstCard ();
    }
    this.drawCard.move = true;
  }
  drawCardReturn () {
    this.drawCard.position = this.goal.position;
  }
  popDrawCard () {
    this.drawCard.show = true;
    this.addBunchCard (this.drawCard);
    this.drawCard = new Card ({
      position: null,
      move: false,
      show: false,
      value: null,
    });
  }

  addCards (newCards) {
    newCards.forEach (c => {
      c.position = this.goal.position;
      c.show = false;
    });
    this.deck.cards = [...newCards, ...this.deck.cards];
    this.profile.health = this.deck.cards.length / gameCards.length * 100;
  }

  addBunchCard (card) {
    card.position = this.deck.positionBunch;
    this.deck.bunchCards.push (card);
    this.deck.cardPlayed = card;
    this.profile.health = this.deck.cards.length / gameCards.length * 100;
  }
}
class Deck {
  constructor () {
    this.radius = 80;
    this.positionBunch = null;
    this.cards = [];
    this.bunchCards = [];
    this.cardPlayed = new Card ({value: null, show: true});
  }
  getFirstCard () {
    return this.cards.pop ();
  }

  cleanBunch () {
    const cards = this.bunchCards;
    this.bunchCards = [];
    this.cardPlayed = new Card ({value: null});
    return cards;
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

const roomsServer = {};
const MAX_PLAYERS = 4;

const getRoom = async id => {
  const roomRef = await db.collection ('rooms').doc (id).get ();

  return roomRef.exists ? {...roomRef.data (), id: roomRef.id} : null;
};

io.sockets.on ('connection', async socket => {
  const id = socket.handshake.query.id;
  console.log ('nouvelle connexion', id);

  if (!id) {
    return;
  }
  const roomDB = await getRoom (id);

  if (!roomDB) {
    console.log ('la room nexiste pas');
    io.to (socket.id).emit ('gameNotExist');
    return;
  }

  if (roomDB.full) {
    io.to (socket.id).emit ('gameFull');
    return;
  }

  let roomServer = roomsServer[roomDB.id];

  if (!roomServer) {
    const newRoom = {
      game: new Game ({id: roomDB.id}),
      id: roomDB.id,
      players: 0,
    };
    roomServer = newRoom;
    roomsServer[roomDB.id] = newRoom;
  }
  socket.join (roomServer.id);
  roomServer.players = roomServer.players + 1;

  const {game} = roomServer;
  const player = game.addPlayer (socket.id);
  roomServer.game.message = `waiting for opponent ${roomServer.players}/${roomDB.numberPlayer}`;

  socket.emit ('gameInit', {player, game});

  io.to (roomServer.id).emit ('gameAddPlayer', {game});

  const roomRef = db.collection ('rooms').doc (roomDB.id);
  const full = roomServer.players === roomDB.numberPlayer ? true : false;
  await roomRef.update ({playersConnected: roomServer.players, full});

  if (game.players.length === roomDB.numberPlayer) {
    game.message =
      ' all players are connected the game is going to start in few second';
    io.to (roomServer.id).emit ('gameWillStart', game);
    setTimeout (() => {
      game.startGame ();

      io.to (roomServer.id).emit ('gameStart', game);
      io.to (roomServer.id).emit ('update', {...game, deck: true});
    }, 4000);
  }

  socket.on ('mouse', function({x, y}) {
    const roomID = Object.keys (socket.rooms)[1];
    const room = roomsServer[roomID];
    const {game} = room;

    const {player} = searchPlayer (socket.id, game);
    const totem = game.totem;
    const checkMoveTotem = checkCollision (player, totem);
    // check if totem move by player
    if (checkMoveTotem && player.click) {
      const totemPosition = {
        x: totem.position.x - (player.position.x - x),
        y: totem.position.y - (player.position.y - y),
      };
      totem.setPosition (totemPosition);
      totem.setPlayerMove (player);

      const checkTotemGoal = checkCollision (totem, player.goal);
      if (checkTotemGoal && player.deck.cardPlayed != null && !game.stop) {
        const playersLost = game.players.reduce ((players, p) => {
          if (
            p.id !== player.id &&
            (p.deck.cardPlayed.value !== null &&
              player.deck.cardPlayed.value !== null) &&
            p.deck.cardPlayed.value === player.deck.cardPlayed.value
          ) {
            return [...players, p];
          }
          return players;
        }, []);
        //player win a round
        if (playersLost.length > 0) {
          const cardsLooser = [];
          let playersLostBunchCards = [...player.deck.bunchCards];
          playersLost.forEach (p => {
            cardsLooser.push ([]);
            playersLostBunchCards = [
              ...playersLostBunchCards,
              ...p.deck.bunchCards,
            ];
          });

          const cardsPerLooser = Math.ceil (
            playersLostBunchCards.length / playersLost.length
          );

          console.log ('carte par joueur', cardsPerLooser);

          let index = 0;
          playersLostBunchCards.forEach (card => {
            const d = cardsLooser[index];

            if (d.length < cardsPerLooser) {
              d.push (card);
            } else {
              console.log ('p' + player.type, d.length);
              index = index + 1;
              cardsLooser[index].push (card);
            }
          });
          io.to (roomID).emit ('animation', {
            cardsLooser,
            playersLost,
          });
          game.stop = true;
          game.players.forEach (p => {
            p.isPlaying = false;
          });
          player.deck.cleanBunch ();

          playersLost.forEach ((p, index) => {
            const cardsForLooser = [
              ...p.deck.bunchCards,
              ...cardsLooser[index],
            ];
            p.deck.cleanBunch ();

            p.addCards (cardsForLooser);
          });

          const playersWin = game.isGameFinish ();
          if (playersWin.length > 0) {
            io.to (roomID).emit ('gameFinish', {playersWin});
          } else {
            const playersType = playersLost.map (p => p.type);
            const message = `player${playersType.join ('/')} +${cardsPerLooser} card noob`;
            const time = 4000;
            io.to (roomID).emit ('message', {message, time});
            const nextPlayer =
              playersLost[Math.floor (Math.random () * playersLost.length)];
            if (nextPlayer.profile.isAlive) {
              game.round = nextPlayer.type;
              nextPlayer.isPlaying = true;
            } else {
              game.nextRound ();
            }
          }
        }
      } else {
        player.goal.setTotemIn (false);
      }
      io.to (roomID).emit ('update', {totem: game.totem});
    }
    //someone moove a card
    if (player.drawCard.move && !player.animationDrawCard && player.click) {
      player.drawCard.position = {x, y};
      io.to (roomID).emit ('update', {card: true, players: game.players});
    }
    player.setPosition ({x, y});
    io.to (roomID).emit ('update', {players: game.players});
  });
  socket.on ('animationDone', player => {
    const roomID = Object.keys (socket.rooms)[1];
    const room = roomsServer[roomID];
    const game = room.game;
    const playerDropCard = game.findPlayer (player.type);

    playerDropCard.drawCard.move = false;
    playerDropCard.animationDrawCard = false;

    io.to (roomID).emit ('update', {
      deck: true,
      bunchCards: true,
      card: true,
      players: game.players,
    });
  });

  socket.on ('animationCardsToDeckDone', () => {
    const roomID = Object.keys (socket.rooms)[1];
    const room = roomsServer[roomID];
    const game = room.game;
    game.stop = false;
    io.to (roomID).emit ('update', {...game, bunchCards: true, deck: true});
  });

  socket.on ('mouseDown', data => {
    const roomID = Object.keys (socket.rooms)[1];
    const room = roomsServer[roomID];
    const game = room.game;

    const {player} = searchPlayer (socket.id, game);
    const click = {
      position: data,
      radius: 1,
    };
    player.setClick (true);

    const checkDrawCard = checkCollision (player.goal, click);
    //someone take a card
    if (
      !player.drawCard.move &&
      !player.animationDrawCard &&
      checkDrawCard &&
      player.deck.cards.length > 0
    ) {
      player.getDrawCard ();
      io.to (roomID).emit ('update', {
        ...game,
        players: game.players,
        card: true,
        goal: true,
      });
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
          io.to (roomID).emit ('animation', {
            cardsLooser: [bunchCards],
            playersLost: [player],
          });
          game.players.forEach (p => {
            p.deck.cleanBunch ();
          });
          const time = 4000;

          player.addCards (bunchCards);

          const playersWin = game.isGameFinish ();

          if (playersWin.length > 0) {
            io.to (roomID).emit ('gameFinish', {playersWin});
          } else {
            const message = `player${player.type} +${bunchCards.length} card noob`;
            io.to (roomID).emit ('message', {message, time});
            if (player.profile.isAlive) {
              game.round = player.type;
              player.isPlaying = true;
            } else {
              game.nextRound ();
            }
            player.isPlaying = true;
            player.timer = 0;
            timePlayer = 0;
          }
        }
      }
      io.to (roomID).emit ('update', {players: game.players});
    }
  });
  socket.on ('mouseUp', () => {
    const roomID = Object.keys (socket.rooms)[1];
    const room = roomsServer[roomID];
    const game = room.game;

    const {player} = searchPlayer (socket.id, game);
    const totem = game.totem;
    player.click = false;
    // someone drop a card
    if (player.drawCard.move && !player.animationDrawCard) {
      let basePosition = player.goal.position;
      const positionBunch = {
        position: {
          ...player.deck.positionBunch,
        },
        radius: 80,
      };
      const checkDropCard = checkCollision (positionBunch, player.drawCard);
      player.animationDrawCard = true;
      // card go to goal
      if (checkDropCard && player.isPlaying === true && !game.stop) {
        io.to (roomID).emit ('animation2', {
          players: game.players,
          player,
          position: positionBunch.position,
        });
        player.drawCard.position = null;
        io.to (roomID).emit ('update', {
          players: game.players,
          card: true,
        });
        game.nextRound ();
        player.popDrawCard ();
      } else {
        //card return deck
        io.to (roomID).emit ('animation2', {
          players: game.players,
          player,
          position: basePosition,
        });
        player.drawCard.position = null;
        io.to (roomID).emit ('update', {
          players: game.players,
          card: true,
        });
        player.drawCardReturn ();
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
          io.to (roomID).emit ('update', {totem})
        );
        totem.intervalId = () => clearInterval (intervalId);
      }
    }
    player.setClick (false);

    io.to (roomID).emit ('update', game);
  });
  socket.on ('disco', () => {
    console.log ("quelqu'un se deconnect");

    const roomID = Object.keys (socket.rooms)[1];

    const room = roomsServer[roomID];
    const game = room.game;
    game.start = false;

    if (game.players.length > 1) {
      game.message =
        'someone leave the game, you will be redirect in the lobby';
      io.to (roomID).emit ('gameStop', {game});

      setTimeout (() => io.to (roomID).emit ('redirect', game), 3000);
    }
    delete roomsServer[roomID];
    const roomRef = db.collection ('rooms').doc (roomID);

    roomRef.update ({players: 0});
  });

  socket.on ('disconnect', function () {
    var rooms = this.adapter.rooms;

    const roomID = Object.keys (rooms)[1];
    const room = roomsServer[roomID];
    if (!room) {
      return;
    }
    const {game} = room;

    const {player} = searchPlayer (socket.id, game);
    if (!player) {
      delete roomsServer[roomID];
      return;
    }
    player.profile.isAlive = false;
    io.to (roomID).emit ('update', {
      players: game.players,
      deck: true,
    });
  });
});
module.exports = {app: app, server: server};
