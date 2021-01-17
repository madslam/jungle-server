import admin from 'firebase-admin';

import { getRoom, updatePlayerRoom } from './src/db'
import Game from './src/Game';
import serviceAccount from './jungle-speed-4f194-0598663160d6';
// npm install uNetworking/uWebSockets.js#v16.2.0
const uWS = require ('uWebSockets.js');
// uWebSockets.js is binary by default
const {StringDecoder} = require ('string_decoder');
const decoder = new StringDecoder ('utf8');
const {v4: uuidv4} = require ('uuid');

const formatMessage = obj => {
  return JSON.stringify (obj);
};
admin.initializeApp ({
  credential: admin.credential.cert (serviceAccount),
});

const db = admin.firestore ();

const roomsServer = {};

// an "app" is much like Express.js apps with URL routes,
// here we handle WebSocket traffic on the wildcard "/*" route
const app = uWS.App ().ws ('/*', {
  // handle messages from client
  message: async (socket, message, isBinary) => {
    // parse JSON and perform the action
    const json = JSON.parse (decoder.write (Buffer.from (message)));

    switch (json.action) {
      case 'connection': {
        // subscribe to messages in said drawing room
        const id = uuidv4 ();
        socket.id = id;
        const { roomId, namePlayer, imgPlayer } = json.data;

        if (!roomId) {
          socket.break;
          return;
        }

        const roomDB = await getRoom (db, roomId);
        if (!roomDB) {
          socket.send(formatMessage ({action: 'gameNotExist'}));
          socket.break;
          return;
        }
      
        if (roomDB.full) {
          socket.send(formatMessage ({action: 'gameFull'}));
          socket.break;
          return;
        }
        let roomServer = roomsServer[roomDB.id];

        if (roomServer && !roomServer.game.ready) {
          socket.send(formatMessage ({action: 'gameNotExist'}));
          socket.break;
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
        socket.subscribe (id);
        socket.subscribe (roomDB.id);
        socket.roomId = roomDB.id;

        roomServer.players = roomServer.players + 1;
      
        const { game } = roomServer;
          
        game.addInitPlayer ({
          id: socket.id,
          skin: 'base',
          skinCard: null,
          name: namePlayer,
          img: imgPlayer,
        });
        if (game.ready) {
          game.message = `waiting for opponent ${roomServer.players}/${game.numberPlayer}`;
        } else {
          game.message = `Choose Game settings then click on Game ready button`;
        }
        app.publish (roomId, formatMessage ({action: 'gameUpdate', data:  {game}}));

        updatePlayerRoom(db, roomServer);
      
        if (game.playersConnected === game.numberPlayer) {
          game.message =
            ' all players are connected the game is going to start in few second';
      
          app.publish(roomId, formatMessage({ action: 'gameWillStart', data: { game } }));

          setTimeout(() => {
            Object.values(game.initPlayerList).forEach((p, index) => {
              const player = game.addPlayer({ ...p, type: index + 1 });
              app.publish(player.id, formatMessage({ action: 'gameInit', data: { player, game } }));
            });
            game.startGame();
      
            app.publish(roomId, formatMessage({ action: 'gameStart', data: { game } }));
            app.publish(roomId, formatMessage({ action: 'update', data: { ...game, deck: true } }));

          }, 4000);

        }
        socket.break;
        break;
      }
      case 'gameReady': {
        const roomId = socket.roomId;
        const { game, players } = roomsServer[roomId];
        game.ready = true;
        game.message = `waiting for opponent ${players}/${game.numberPlayer}`;
    
        console.log('on est ready')
        app.publish(roomId, formatMessage({ action: 'gameUpdate', data: { game } }));
        break;
      }
      case 'playerReady': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];
    
        game.initPlayerList[socket.id].ready = true;
        app.publish(roomId, formatMessage({ action: 'gameUpdate', data: { game } }));
        break;
      }
      case 'setSkinCard': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const skinCard = json.data
        game.initPlayerList[socket.id].skinCard = skinCard;
        break;
      }
      case 'setSkin': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const skin= json.data
        game.initPlayerList[socket.id].skin = skin;
        break;
      }
      case 'setTimePerRound': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const timePerRound= json.data
        if (!game.ready) {
          game.timePerRound = timePerRound;
        }
      break;
      }
      case 'setNumberPlayer': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const numberPlayer= json.data
        if (!game.ready) {
          game.numberPlayer = numberPlayer;
          game.rotationPerPlayer = 360 / numberPlayer;
        }
      break;
      }
      case 'shitPlayer': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const disable= json.data
        const { player } = game.searchPlayer(socket.id);
        player.disableClick = disable;
        app.publish(roomId, formatMessage({
          action: 'update', data: {
            players: game.players,
            playersMove: true,
          }
        }));
      break;
      }
      case 'nextRound': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const { player } = game.searchPlayer(socket.id);
    
        if (player.type === game.round) {
          player.isPlaying = null;
          await game.nextRound ();
          app.publish(roomId, formatMessage({
            action: 'update', data: {
              nextRound: game.players
            }
          }));
        }
      break;
      }       
      case 'mousemove': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];
        const {position} = json.data

        const { player } = game.searchPlayer(socket.id);
        const data = { players: game.players, playersMove:true }
  
        if (player?.drawCard.move &&  !player.animationDrawCard) {
              //someone moove a card
          player.drawCard.position = position;
          data.playerDrawCard = player;

        }
        if (game?.totem?.playerMove?.type === player.type) {
          const totemPosition = {
            x: game.totem.position.x - (player.position.x - position.x),
            y: game.totem.position.y - (player.position.y - position.y),
          };
          game.totem.position = totemPosition;
          data.totem =  game.totem;
        }
        if (player) {
          player.setPosition(position);
        }
        app.publish(roomId, formatMessage({
          action: 'update', data
        }));
        break;
      }
      case 'totemToBase': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];

          game.totem.playerMove = null;
          const {width, height} = game;
          const basePosition = {
            x: width / 2,
            y: height / 2,
          };
          game.totem.nextPosition = basePosition;
          app.publish(roomId, formatMessage({
            action: 'animationTotem', data: {
              totem: game.totem,
            }
          }));
        

        break;
      }
      case 'totemInGoal': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];
        const { player } = game.searchPlayer(socket.id);

          game.totem.playerMove = null;
          const {width, height} = game;
          const basePosition = {
            x: width / 2,
            y: height / 2,
        };
          game.totem.nextPosition = basePosition;
          app.publish(roomId, formatMessage({
            action: 'animationTotem', data: {
              totem: game.totem,
            }
          }));
        if (player.deck.cardPlayed != null && !game.stop) {
          const playersLost = game.players.reduce((players, p) => {
            if (
              p.id !== player.id &&
              (p.deck.cardPlayed.value !== null &&
                player.deck.cardPlayed.value !== null) &&
              p.deck.cardPlayed.value === player.deck.cardPlayed.value
            ) {
              return [...players, { player: p, numberCards: 0 }];
            }
            return players;
          }, []);
          //player win a round
          if (playersLost.length > 0) {
            const cardsLooser = [];
            let playersLostBunchCards = [...player.deck.bunchCards];
            playersLost.forEach(({ player }) => {
              playersLostBunchCards = [
                ...playersLostBunchCards,
                ...player.deck.bunchCards,
              ];
            });
    
            const cardsPerLooser = Math.ceil(
              playersLostBunchCards.length / playersLost.length
            );
    
            let index = 0;
    
            playersLostBunchCards.forEach(card => {
              if (playersLost[index].numberCards < cardsPerLooser) {
                card.goTo = index;
                card.nextPosition = playersLost[index].player.goal.position;
                playersLost[index].numberCards++;
                cardsLooser.push(card);
                playersLost[index].player.addCards([card]);
              } else {
                index = index + 1;
                card.nextPosition = playersLost[index].player.goal.position;
                playersLost[index].numberCards++;
                playersLost[index].player.addCards([card]);
              }
            });

            app.publish(roomId, formatMessage({
              action: 'animationBunchCards', data: {
                cardsLooser,
                playersLost,
              }
            }));
            game.stop = true;
            const { players } = game;
            players.forEach(p => {
              p.isPlaying = null;
            });
            player.deck.cleanBunch();
    
            playersLost.forEach(({ player }) => {
              player.deck.cleanBunch();
            });
           /* io.to(roomID).emit('animationHealth', {
              players: game.players,
              profile: true,
            });*/
            playersLost.forEach(({ player }) => {
              player.changeHealth();
            });
    
            const playersWin = game.isGameFinish();
            if (playersWin.length > 0) {
              app.publish(roomId, formatMessage({
                action: 'gameFinish', data: {
                  playersWin
                }
              }));
            } else {
              const playersType = playersLost.map(p => p.type);
              const message = `player${playersType.join('/')} +${cardsPerLooser} card noob`;
              game.history.push(
                `player${playersType.join('/')} +${cardsPerLooser} card noob`
              );
              const time = 4000;
              app.publish(roomId, formatMessage({
                  action: 'message', data: {
                    message, time, history: game.history
                  }
              }));
              const nextPlayer =
                playersLost[Math.floor(Math.random() * playersLost.length)]
                  .player;
              if (nextPlayer.profile.isAlive) {
                game.round = nextPlayer.type;
                nextPlayer.isPlaying = Date.now();
              } else {
                await game.nextRound();
              }

              app.publish(roomId, formatMessage({
                action: 'update', data: {
                  nextRound: game.players                }
            }));
            }
          }
        }

        break;
      }
      case 'cardToDeck': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        const { player } = game.searchPlayer(socket.id);
        if (!game.stop && !player.animationDrawCard) {
          player.drawCard.move = false;
          player.animationDrawCard = true;
          player.drawCard.moveTo = 'deck';
          app.publish(roomId, formatMessage({
            action: 'animationDrawCard', data: {
              player
            }
          }));
        }
        
        break; 
      }
      case 'cardToBunch': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];
        const { player } = game.searchPlayer(socket.id);

        if (!game.stop && !player.animationDrawCard) {
          player.drawCard.move = false;
          player.animationDrawCard = true;
          player.drawCard.moveTo = 'bunch';

          app.publish(roomId, formatMessage({
            action: 'animationDrawCard', data: {
              player,
            }
          }));
          player.updateNextHealth();

          app.publish(roomId, formatMessage({
            action: 'animationHealth', data: {
              players: game.players,
            }
          }));
          const { nextPlayer, gameFinish } = game.isGameEgality();
          if (!nextPlayer) {
            if (gameFinish) {
              app.publish(roomId, formatMessage({
                action: 'gameEgality'
              }));
              return;
            }
          } else {
            player.isPlaying = null;
            await game.nextRound();
            app.publish(roomId, formatMessage({
              action: 'update', data: {
                nextRound: game.players,
              }
            }));
          }
        }
        break; 
      }
      case 'drawCard': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];

        const { player } = game.searchPlayer(socket.id);
        player.getDrawCard();
        app.publish(player.id, formatMessage({
          action: 'updatePlayer', data: {
            player,
          }
        }));
        app.publish(roomId, formatMessage({
          action: 'update', data: {
            players: game.players,
            playerDrawCard: player,
            cards: true,
          }
        }));
      
        break;
      }
      case 'moveTotem': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];

        const { player } = game.searchPlayer(socket.id);
        
        game.totem.setPlayerMove(player);
      
        app.publish(roomId, formatMessage({
          action: 'update', data: {
            totem: game.totem,
          }
        }));
        const isNoCardPlayed = game.players.every (
          p => p.deck.cardPlayed.value === null
        );
        if (!isNoCardPlayed) {
          const playerSameCard = game.isPlayersSameCard( player )
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
  
            app.publish(roomId, formatMessage({
              action: 'animationBunchCards', data: {
                cardsLooser: bunchCards,
                playersLost: [
                  {
                    player,
                    numberCards: bunchCards.length,
                  },
                ],
              }
            }));
            game.players.forEach (p => {
              p.deck.cleanBunch ();
            });
            const time = 4000;

            player.addCards (bunchCards);
 
            app.publish(roomId, formatMessage({
              action: 'animationHealth', data: {
                players: game.players,
              }
            }));
            player.changeHealth ();
            const playersWin = game.isGameFinish ();

            if (playersWin.length > 0) {              
              app.publish(roomId, formatMessage({
                action: 'gameFinish', data: {
                  playersWin,
                }
              }));
            } else {
              const message = `player${player.type} +${bunchCards.length} card noob`;
              game.history.push (
                `player${player.type} +${bunchCards.length} card noob`
              );
              app.publish(roomId, formatMessage({
                  action: 'message', data: {
                    message, time, history: game.history 
                  }
              }));
              const nextPlayer = player;
              if (nextPlayer.profile.isAlive) {
                game.round = player.type;
                player.isPlaying = Date.now ();
              } else {
                await game.nextRound ();
              }
              app.publish(roomId, formatMessage({
                action: 'update', data: {
                  nextRound: game.players
                  ,
                }
              }));
            }
          }
        }
      
        break;
      }
      case 'animationTotemDone': {
        const roomId = socket.roomId;
        const {game} = roomsServer[roomId];
        if (game.totem.nextPosition) {
          game.totem.position = game.totem.nextPosition;
          game.totem.nextPosition = null;
          app.publish(roomId, formatMessage({
            action: 'update', data: {
              totem: game.totem
            }
          }));
        }
        break;
      }
      case 'animationDrawCardDone': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];
        
        const { player } = json.data


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
          app.publish(roomId, formatMessage({
            action: 'update', data: {
              bunchCards: true,
              cards: true,
              players: game.players,
              playerPlay: game.playerPlay,
              playerDrawCard: playerDropCard,
            }
          }));
        }
  

        break;
      }
      case 'animationCardsToDeckDone': {
        const roomId = socket.roomId;
        const { game } = roomsServer[roomId];

        game.stop = false;
        app.publish(roomId, formatMessage({
          action: 'update', data: {
            players: game.players,
            cards: true,
            playerPlay: game.playerPlay,
          }
        }));
      break;
      }
      case 'leave': {
        // unsubscribe from the said drawing room
        socket.unsubscribe (json.room);
        break;
      }
    }
  },
});
app.listen (8080, listenSocket => {
  if (listenSocket) {
    console.log ('Listening to port 8080');
  }
});
