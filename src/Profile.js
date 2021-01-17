export default class Profile {
    constructor({position, name, img, timePerRound}) {
      this.position = position;
      this.name = name;
      this.radius = 30;
      this.nextHealth = null;
      this.healt = 0;
      this.isAlive = true;
      this.isPlaying = null;
      this.img = img;
      this.timePerRound = timePerRound;
    }
  }