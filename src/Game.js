import Goal from './Goal';
import Profile from './Profile';
import Totem from './Totem';
import Deck from './Deck';
import Player from './Player';
import Card from './Card';

export const gameCards = [
    1,
    1,
    1,
    2,
    2,
    2,
    3,
    3,
    3,
    4,
    4,
    4,
    5,
    5,
    5,
    6,
    6,
    6,
    7,
    7,
    7,
    8,
    8,
    8,
    9,
    9,
    9,
  ];
export default class Game {
    constructor({id, numberPlayer, timePerRound}) {
      this.id = id;
      this.players = [];
      this.playerPlay = null;
      this.width = 1000;
      this.height = 900;
      this.ready = false;
      this.initPlayerList = {};
      this.gameCards = [...gameCards];
      this.timePerRound = timePerRound;
      this.history = [];
      this.round = 0;
      this.start = false;
      this.stop = false;
      this.message = '';
      this.playersConnected = 0;
      this.totem = new Totem ({
        position: {x: this.width / 2, y: this.height / 2},
      });
      this.numberPlayer = numberPlayer;
      this.rotationPerPlayer = 360 / numberPlayer;
    }
    findPlayer (type) {
      return this.players.find (p => p.type === type);
    }
    addInitPlayer (player) {
      this.playersConnected++;
      this.initPlayerList[player.id] = player;
      if (!player.name) {
        this.initPlayerList[player.id].name = 'player ' + this.playersConnected;
      }
    }
    addPlayer({id, name, skin, skinCard, type, img}) {
      const goal = new Goal ({type});
      const deck = new Deck ();
      const profile = new Profile ({
        name,
        img,
        timePerRound: this.timePerRound,
      });
      const radius = 340;
      const angle = (type - 1) * this.rotationPerPlayer;
      const x = Math.round (
        radius * Math.sin (Math.PI * 2 * angle / 360) + this.width / 2
      );
      const y = Math.round (
        radius * Math.cos (Math.PI * 2 * angle / 360) + this.height / 2
      );
      goal.position = {
        x,
        y,
      };
  
      var xDist = this.width / 2 - x;
      var yDist = this.width / 2 - y;
      var dist = Math.sqrt (xDist * xDist + yDist * yDist);
      var fractionOfTotal = 150 / dist;
  
      deck.positionBunch = {
        x: Math.round (x + xDist * fractionOfTotal),
        y: Math.round (y + yDist * fractionOfTotal),
      };
  
      profile.position = {
        x: x - 100,
        y,
      };
  
      const player = new Player ({
        id,
        type,
        goal,
        deck,
        profile,
        skin,
        skinCard,
        angle,
        name,
      });
      this.players.push (player);
      return player;
    }
  
    distributeCards () {
      const cardsByPlayer = this.gameCards.length / this.players.length;
      this.players.forEach (player => {
        const deckPlayer = [];
        for (let x = 0; x < cardsByPlayer; x++) {
          if (this.gameCards.length > 0) {
            const random = Math.random () * this.gameCards.length;
  
            const value = this.gameCards.splice (random, 1)[0];
  
            const num = Math.floor (Math.random () * 13) + 1; // this will get a number between 1 and 99;
            const rotation =
              num * (Math.floor (Math.random () * 2) == 1 ? 1 : -1);
            const newCard = new Card ({
              move: false,
              position: player.goal.position,
              skinCard: player.skinCard,
              show: false,
              value,
              rotation,
            });
            deckPlayer.push (newCard);
          }
        }
  
        player.addCards (deckPlayer);
        player.changeHealth ();
      });
    }
    startGame () {
      this.distributeCards ();
      this.round = 1;
      this.players[this.round - 1].isPlaying = Date.now ();
      this.playerPlay = this.players[this.round - 1];
      this.start = true;
  }
  isPlayersSameCard ( player ) {
    
    return this.players.find (
      p =>
        p.id !== player.id &&
        p.deck.cardPlayed.value &&
        p.deck.cardPlayed.value === player.deck.cardPlayed.value
    );
  }
    isGameEgality () {
      const isNoNextPlayer = this.players.every (p => p.deck.cards.length === 0);
      if (isNoNextPlayer) {
        const cardsPlayedValue = [];
  
        const isSameCard = this.players.find (p => {
          const isSameCard = cardsPlayedValue.includes (p.deck.cardPlayed.value);
          cardsPlayedValue.push (p.deck.cardPlayed.value);
  
          if (isSameCard) {
            return true;
          }
          return false;
        });
        if (!isSameCard) {
          this.stop = true;
  
          return {nextPlayer: false, gameFinish: true};
        }
        return {nextPlayer: false};
      }
      return {nextPlayer: true};
    }
    isGameFinish () {
      const playersWin = this.players.reduce ((winners, p) => {
        if (
          p.deck.cards.length === 0 &&
          p.deck.bunchCards.length === 0 &&
          p.drawCard.value === null
        ) {
          return [...winners, p];
        }
        return winners;
      }, []);
      if (playersWin.length > 0) {
        this.stop = true;
      }
      return playersWin;
    }
    nextRound (iteration = 0) {
      if (iteration === 0) {
        const currentPlayer = this.players[this.round - 1];
        currentPlayer.isPlaying = null;
      }
  
      if (iteration >= this.players.length) {
        return;
      }
      const newRound = this.round + 1 > this.players.length ? 1 : this.round + 1;
  
      const nextPlayer = this.players[newRound - 1];
  
      if (
        (nextPlayer.deck.cards.length > 0 || nextPlayer.drawCard.position) &&
        nextPlayer.profile.isAlive
      ) {
        this.round = newRound;
  
        nextPlayer.isPlaying = Date.now ();
        this.playerPlay = nextPlayer;
        return nextPlayer;
      } else {
        this.round = newRound;
        const newIteration = iteration + 1;
        this.nextRound (newIteration);
      }
    }

    searchPlayer (id) {
      let i = null;
      this.players.forEach (function (player, index) {
        if (player.id === id) {
          i = index;
        }
      });
      return {player: this.players[i], index: i};
    };

  
  playerLost(id) {
    
    
  }
  }