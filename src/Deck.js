import Card from './Card';

export default class Deck {
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