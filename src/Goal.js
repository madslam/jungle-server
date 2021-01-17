export default class Goal {
    constructor({type, position}) {
      this.position = position;
      this.type = type;
      this.radius = 50;
      this.totemIn = false;
    }
    setTotemIn (totemIn) {
      this.totemIn = totemIn;
    }
  }