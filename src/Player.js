import Card from './Card';
import { gameCards } from './Game';

export default class Player {
    constructor({id, type, name, deck, goal, profile, skin, skinCard, angle}) {
      this.position = {
        x: Math.floor (Math.random () * 1000),
        y: Math.floor (Math.random () * 1000),
      };
      this.name = name;
      this.angle = angle;
      this.deck = deck;
      this.type = type;
      this.radius = 5;
      this.id = id;
      this.click = false;
      this.isPlaying = null;
      this.goal = goal;
      this.profile = profile;
      this.skin = skin;
      this.skinCard = skinCard;
      this.disableClick = false;
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
      this.drawCard.move = false;
      this.deck.cards.push (this.drawCard);
      this.drawCard = new Card ({
        position: null,
        show: false,
        move: false,
        value: null,
      });
    }
    popDrawCard () {
      this.drawCard.show = true;
      this.drawCard.move = false;
  
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
      this.updateNextHealth()
    }
  
    addBunchCard (card) {
      card.position = this.deck.positionBunch;
      this.deck.bunchCards.push (card);
      this.deck.cardPlayed = card;
      this.updateNextHealth()
    }
  
    updateNextHealth() {
        this.profile.nextHealth = Math.round (
            this.deck.cards.length / gameCards.length * 100
          );
    }
    changeHealth () {
      this.profile.health = this.profile.nextHealth;
      this.profile.nextHealth = null;
    }
  }
