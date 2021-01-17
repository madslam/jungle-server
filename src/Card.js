export default class Card {
    constructor({position, move, value, rotation, show, skinCard}) {
      this.id = 'c' + Math.floor (Math.random () * 1000);
      this.position = position;
      this.move = move;
      this.radius = 80;
      this.show = show;
      this.value = value;
      this.rotation = rotation;
      this.skinCard = skinCard;
    }
  }