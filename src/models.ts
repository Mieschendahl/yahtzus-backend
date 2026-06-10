import { random, sum } from "./utils";
import { FieldIO, DiceIO, FIELD_ID, PlayerIO } from "./shared/socket-types";

export class Player {
  constructor(
    public userId: string,
    public fields: FieldIO = {} 
  ) {
    for (const fieldId of FIELD_ID) {
      this.fields[fieldId] = {
        value: undefined,
        isPreview: false
      }
    }
  }

  getTotalValue(): number {
    return sum(Object.keys(this.fields).map(key => this.fields[key]?.value ?? 0));
  }

  getFieldValue(fieldId: string): number | undefined {
    return this.fields[fieldId]?.value;
  }

  toIO(): PlayerIO {
    return {
      userId: this.userId,
      fields: this.fields
    };
  }

  static fromIO({userId, fields: column}: PlayerIO): Player {
    return new Player(userId, column);
  }
}

export class Dice {
  constructor(
    public num: number = 1,
    public selected: boolean = true
  ) {}

  roll() {
    this.num = random.integer(1, 6)
  }

  toIO(): DiceIO {
    return {
      num: this.num,
      selected: this.selected
    };
  }

  static fromIO({num, selected}: DiceIO): Dice {
    return new Dice(num, selected);
  }

  static createDice(): Dice[] {
    return Array.from({length: 5}, () => new Dice());
  }
}