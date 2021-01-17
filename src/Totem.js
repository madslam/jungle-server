export default class Totem {
    constructor({position}) {
      this.position = position;
      this.radius = 70;
      this.playerMove = null;
    }
    setPosition (position) {
      this.position = position;
    }
    setPlayerMove (playerMove) {
      this.playerMove = playerMove;
    }
  }