import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import socketio from 'socket.io';
import admin from 'firebase-admin';

import Game from './src/Game';
import serviceAccount from './jungle-speed-4f194-0598663160d6';

const app = express ();
admin.initializeApp ({
  credential: admin.credential.cert (serviceAccount),
});

const db = admin.firestore ();

app.use (logger ('dev'));
app.use (express.json ());
app.use (express.urlencoded ({extended: false}));
app.use (cookieParser ());

app.get ('/health', (req, res) => {
  res.send ('ok');
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


const io = socketio (server);






const checkCollision = (obj1, obj2) => {
  let vx = obj1.position.x - obj2.position.x;
  let vy = obj1.position.y - obj2.position.y;
  let length = Math.sqrt (vx * vx + vy * vy);

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

const roomsServer = {};

const getRoom = async id => {
  const roomRef = await db.collection ('rooms').doc (id).get ();

  return roomRef.exists ? {...roomRef.data (), id: roomRef.id} : null;
};

io.sockets.on ('connection', async socket => {
  const id = socket.handshake.query.id;
  const namePlayer = socket.handshake.query.namePlayer;
  const imgPlayer = socket.handshake.query.imgPlayer;

  if (!id) {
    return;
  }
  const roomDB = await getRoom (id);

  if (!roomDB) {
    io.to (socket.id).emit ('gameNotExist');
    return;
  }

  if (roomDB.full) {
    io.to (socket.id).emit ('gameFull');
    return;
  }

  let roomServer = roomsServer[roomDB.id];
  if (roomServer && !roomServer.game.ready) {
    io.to (socket.id).emit ('gameNotExist');
    return;
  }
  if (!roomServer) {
    const newRoom = {
      game: new Game ({
        id: roomDB.id,
        numberPlayer: roomDB.numberPlayer,
        timePerRound: roomDB.timePerRound,
      }),
      id: roomDB.id,
      players: 0,
    };
    roomServer = newRoom;
    roomsServer[roomDB.id] = newRoom;
  }
  socket.join (roomServer.id);
  roomServer.players = roomServer.players + 1;

  const {game} = roomServer;

  if (game.ready) {
    game.message = `waiting for opponent ${roomServer.players}/${game.numberPlayer}`;
  } else {
    game.message = `Choose Game settings then click on Game ready button`;
  }

  game.addInitPlayer ({
    id: socket.id,
    skin: 'base',
    skinCard: null,
    name: namePlayer,
    img: imgPlayer,
  });
  io.to (roomServer.id).emit ('gameUpdate', {game});

  const roomRef = db.collection ('rooms').doc (roomDB.id);
  const full = roomServer.players === game.numberPlayer ? true : false;
  await roomRef.update ({playersConnected: roomServer.players, full});

  if (game.playersConnected === game.numberPlayer) {
    game.message =
      ' all players are connected the game is going to start in few second';

    io.to (roomServer.id).emit ('gameWillStart', game);
    setTimeout (() => {
      Object.values (game.initPlayerList).forEach ((p, index) => {
        const player = game.addPlayer ({...p, type: index + 1});
        io.to (player.id).emit ('gameInit', {player, game});
      });
      game.startGame ();

      io.to (roomServer.id).emit ('gameStart', game);
      io.to (roomServer.id).emit ('update', {...game, deck: true});
    }, 4000);
  }

  
  socket.on ('mouse', async ({x, y}) => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;

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
        const playersLost = game.players.reduce ((players, p) => {
          if (
            p.id !== player.id &&
            (p.deck.cardPlayed.value !== null &&
              player.deck.cardPlayed.value !== null) &&
            p.deck.cardPlayed.value === player.deck.cardPlayed.value
          ) {
            return [...players, {player: p, numberCards: 0}];
          }
          return players;
        }, []);
        //player win a round
        if (playersLost.length > 0) {
          const cardsLooser = [];
          let playersLostBunchCards = [...player.deck.bunchCards];
          playersLost.forEach (({player}) => {
            playersLostBunchCards = [
              ...playersLostBunchCards,
              ...player.deck.bunchCards,
            ];
          });

          const cardsPerLooser = Math.ceil (
            playersLostBunchCards.length / playersLost.length
          );

          let index = 0;

          playersLostBunchCards.forEach (card => {
            if (playersLost[index].numberCards < cardsPerLooser) {
              card.goTo = index;
              card.nextPosition = playersLost[index].player.goal.position;
              playersLost[index].numberCards++;
              cardsLooser.push (card);
              playersLost[index].player.addCards ([card]);
            } else {
              index = index + 1;
              card.nextPosition = playersLost[index].player.goal.position;
              playersLost[index].numberCards++;
              playersLost[index].player.addCards ([card]);
            }
          });
          io.to (roomID).emit ('animationBunchCards', {
            cardsLooser,
            playersLost,
          });
          game.stop = true;
          const {players} = game;
          players.forEach (p => {
            p.isPlaying = null;
          });
          player.deck.cleanBunch ();

          playersLost.forEach (({player}) => {
            player.deck.cleanBunch ();
          });
          io.to (roomID).emit ('animationHealth', {
            players: game.players,
            profile: true,
          });
          playersLost.forEach (({player}) => {
            player.changeHealth ();
          });

          const playersWin = game.isGameFinish ();
          if (playersWin.length > 0) {
            io.to (roomID).emit ('gameFinish', {playersWin});
          } else {
            const playersType = playersLost.map (p => p.type);
            const message = `player${playersType.join ('/')} +${cardsPerLooser} card noob`;
            game.history.push (
              `player${playersType.join ('/')} +${cardsPerLooser} card noob`
            );
            const time = 4000;
            io
              .to (roomID)
              .emit ('message', {message, time, history: game.history});
            const nextPlayer =
              playersLost[Math.floor (Math.random () * playersLost.length)]
                .player;
            if (nextPlayer.profile.isAlive) {
              game.round = nextPlayer.type;
              nextPlayer.isPlaying = Date.now ();
            } else {
              await game.nextRound ();
            }
            io.to (roomID).emit ('update', {nextRound: game.players});
          }
        }
      } else {
        player.goal.setTotemIn (false);
      }
      io.to (roomID).emit ('update', {totem: game.totem});
    }
    //move player
    player.setPosition ({x, y});
    //someone moove a card
    if (player.drawCard.move && !player.animationDrawCard && player.click) {
      player.drawCard.position = {x, y};
      io.to (roomID).emit ('update', {
        players: game.players,
        playerDrawCard: player,
        playersMove: true,
      });
    } else {
      io.to (roomID).emit ('update', {
        players: game.players,
        playersMove: true,
      });
    }
  });
  socket.on ('animationTotemDone', () => {
    const roomID = Object.keys (socket.rooms)[1];

    if (game.totem.nextPosition) {
      const {game} = roomServer;
      game.totem.position = game.totem.nextPosition;
      game.totem.nextPosition = null;
      io.to (roomID).emit ('update', {totem: game.totem});
    }
  });

  socket.on ('animationDrawCardDone', player => {
    const {game} = roomServer;
    const playerDropCard = game.findPlayer (player.type);

    if (playerDropCard.animationDrawCard) {
      if (playerDropCard.drawCard.moveTo === 'bunch') {
        playerDropCard.popDrawCard ();

        playerDropCard.changeHealth ();
      }
      if (playerDropCard.drawCard.moveTo === 'deck') {
        playerDropCard.drawCardReturn ();
      }
      playerDropCard.animationDrawCard = false;
    }

    io.to (socket.id).emit ('update', {
      bunchCards: true,
      cards: true,
      players: game.players,
      playerPlay: game.playerPlay,
      playerDrawCard: playerDropCard,
    });
  });

  socket.on ('animationCardsToDeckDone', () => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;
    game.stop = false;
    io.to (roomID).emit ('update', {
      players: game.players,
      cards: true,
      playerPlay: game.playerPlay,
    });
  });

  socket.on ('nextRound', async () => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;
    const {player} = searchPlayer (socket.id, game);
    if (player.type === game.round) {
      player.isPlaying = null;
      await game.nextRound ();
      io.to (roomID).emit ('update', {nextRound: game.players});
    }
  });
  socket.on ('shitPlayer', disable => {
    const {game} = roomServer;
    const roomID = Object.keys (socket.rooms)[1];
    const {player} = searchPlayer (socket.id, game);

    player.disableClick = disable;
    io.to (roomID).emit ('update', {
      players: game.players,
      playersMove: true,
    });
  });
  socket.on ('setNumberPlayer', numberPlayer => {
    const roomID = Object.keys (socket.rooms)[1];
    const {game} = roomServer;

    if (!game.ready) {
      game.numberPlayer = numberPlayer;
      game.rotationPerPlayer = 360 / numberPlayer;
      io.to (roomID).emit ('gameUpdate', {game});
    }
  });
  socket.on ('setTimePerRound', timePerRound => {
    const roomID = Object.keys (socket.rooms)[1];
    const {game} = roomServer;

    if (!game.ready) {
      game.timePerRound = timePerRound;
      io.to (roomID).emit ('gameUpdate', {game});
    }
  });
  socket.on ('gameReady', () => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;
    game.ready = true;
    game.message = `waiting for opponent ${roomServer.players}/${game.numberPlayer}`;

    io.to (roomID).emit ('gameUpdate', {game});
  });
  socket.on ('setSkin', skin => {
    const {game} = roomServer;
    game.initPlayerList[socket.id].skin = skin;
  });
  socket.on ('setSkinCard', skinCard => {
    const {game} = roomServer;
    game.initPlayerList[socket.id].skinCard = skinCard;
  });

  socket.on ('playerReady', () => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;
    game.initPlayerList[socket.id].ready = true;
    io.to (roomID).emit ('gameUpdate', {game});
  });

  socket.on ('mouseDown', async data => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;

    const { player } = searchPlayer(socket.id, game);
    const click = {
      position: data,
      radius: 1,
    };
    player.setClick (true);

    if (!game.stop) {
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
          players: game.players,
          playerDrawCard: player,
          cards: true,
        });
      } else {
        const checkMoveTotem = checkCollision (player, game.totem);
        if (checkMoveTotem && !game.stop) {
          game.totem.setPlayerMove (player);
          const isNoCardPlayed = game.players.every (
            p => p.deck.cardPlayed.value === null
          );
          if (!isNoCardPlayed) {
            const playerSameCard = game.players.find (
              p =>
                p.id !== player.id &&
                p.deck.cardPlayed.value &&
                p.deck.cardPlayed.value === player.deck.cardPlayed.value
            );
            // someone get totem without the same card with other player
            if (!playerSameCard) {
              const bunchCards = game.players.reduce ((cards, p) => {
                return [...cards, ...p.deck.bunchCards];
              }, []);
              game.players.forEach (p => {
                p.isPlaying = null;
              });
              bunchCards.forEach (card => {
                card.nextPosition = player.goal.position;
              });

              game.stop = true;
              io.to (roomID).emit ('animationBunchCards', {
                cardsLooser: bunchCards,
                playersLost: [
                  {
                    player,
                    numberCards: bunchCards.length,
                  },
                ],
              });
              game.players.forEach (p => {
                p.deck.cleanBunch ();
              });
              const time = 4000;

              player.addCards (bunchCards);
              io.to (roomID).emit ('animationHealth', {
                players: game.players,
              });
              player.changeHealth ();
              const playersWin = game.isGameFinish ();

              if (playersWin.length > 0) {
                io.to (roomID).emit ('gameFinish', {playersWin});
              } else {
                const message = `player${player.type} +${bunchCards.length} card noob`;
                game.history.push (
                  `player${player.type} +${bunchCards.length} card noob`
                );

                io
                  .to (roomID)
                  .emit ('message', {message, time, history: game.history});
                const nextPlayer = player;
                if (nextPlayer.profile.isAlive) {
                  game.round = player.type;
                  player.isPlaying = Date.now ();
                } else {
                  await game.nextRound ();
                }
                io.to (roomID).emit ('update', {nextRound: game.players});
              }
            }
          }
        }
      }
    }
  });
  socket.on ('mouseUp', async () => {
    const roomID = Object.keys (socket.rooms)[1];

    const {game} = roomServer;

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
      if (checkDropCard && player.isPlaying && !game.stop) {
        player.drawCard.moveTo = 'bunch';

        io.to (roomID).emit ('animationDrawCard', {
          player,
        });
        player.updateNextHealth();
        
        io.to (roomID).emit ('animationHealth', {
          players: game.players,
        });

        const {nextPlayer, gameFinish} = game.isGameEgality ();
        if (!nextPlayer) {
          if (gameFinish) {
            io.to (roomID).emit ('gameEgality');
            return;
          }
        } else {
          player.isPlaying = null;
          await game.nextRound ();
          io.to (roomID).emit ('update', {nextRound: game.players});
        }
      } else {
        player.drawCard.moveTo = 'deck';

        //card return deck
        io.to (roomID).emit ('animationDrawCard', {
          players: game.players,
          player,
          position: basePosition,
        });
      }
    }
    // totem return origin
    if (totem.playerMove && player.id === totem.playerMove.id) {
      totem.setPlayerMove (null);
      const {width, height} = game;
      const basePosition = {
        x: width / 2,
        y: height / 2,
      };
      totem.nextPosition = basePosition;
      io.to (roomID).emit ('animationTotem', {totem});
    }
  });

  socket.on ('disconnect', async () => {
    const roomID = roomServer.id;

    if (!roomServer) {
      return;
    }
    const {game} = roomServer;

    game.playersConnected--;
    if (game.start) {
      const {player} = searchPlayer (socket.id, game);

      player.profile.isAlive = false;
      if (player.isPlaying) {
        player.isPlaying = null;
        await game.nextRound ();
      }
      io.to (roomID).emit ('update', {
        players: game.players,
        playerDrawCard: player,
        profile: true,
      });
    } else {
      game.initPlayerList[socket.id] = null;
      io.to (roomID).emit ('gameUpdate', game);
    }
    if (game.playersConnected === 0) {
      roomsServer[roomID] = null;
    }
  });
});
module.exports = {app: app, server: server};
