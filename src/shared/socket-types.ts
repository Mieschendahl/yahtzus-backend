
export const EFFECT_DATA = [
  // {
  //   effectId: "Extra Roll",
  //   type: "turn effect"
  // },
  // {
  //   effectId: "Extra Dice",
  //   type: "turn effect"
  // },
  {
    effectId: "Double Value",
    type: "turn effect"
  },
  // {
  //   effectId: "Roll High",
  //   type: "roll effect"
  // },
  // {
  //   effectId: "Roll Low",
  //   type: "roll effect"
  // }
];

export const EFFECT_IDS = EFFECT_DATA.map(({effectId}) => effectId);

export function getEffectIndex(effectId: string): number {
  return EFFECT_IDS.findIndex(effectId_ => effectId === effectId_);
}

export const FIELD_DATA = [
  {
    fieldId: "User ID",
    isPrimitive: false
  },
  {
    fieldId: "Ones",
    isPrimitive: true,
  },
  {
    fieldId: "Twos",
    isPrimitive: true,
  },
  {
    fieldId: "Threes",
    isPrimitive: true
  },
  {
    fieldId: "Fours",
    isPrimitive: true
  },
  {
    fieldId: "Fives",
    isPrimitive: true
  },
  {
    fieldId: "Sixes",
    isPrimitive: true
  },
  {
    fieldId: "Bonus",
    isPrimitive: false
  },
  {
    fieldId: "Total",
    isPrimitive: false
  }
];

export const FIELD_IDS = FIELD_DATA.map(({fieldId}) => fieldId);

export function getFieldIndex(fieldId: string): number {
  return FIELD_IDS.findIndex(fieldId_ => fieldId === fieldId_);
}

export type EffectData = {
  effectId?: string,
  status: "locked" | "unlocked" | "in use" | "used"
};

export type FieldData = {
  fieldId: string;
  index: number;
  isPrimitive: boolean;
  value?: string;
  isPreview: boolean;
  effect: EffectData;
};

export type PlayerIO = {
  userId: string;
  fields: FieldData[];
};

export type DiceIO = {
  num: number;
  selected: boolean;
}

export type StateIO = (
  | {
    kind: "lobby",
    data?: undefined
  }
  | {
    kind: "playing"
    data?: undefined
  }
);

export type GameIO = {
  players: PlayerIO[]
  dices: DiceIO[];
  activePlayerId?: number;
  rollCount?: number;
  state: StateIO;
};

export type ClientData = (
  | {
    kind: "join room";
    data: {
      userId?: string
    }
  }
  | {
    kind: "leave room";
    data?: undefined;
  }
  | {
    kind: "join players";
    data?: undefined
  }
  | {
    kind: "leave players";
    data?: undefined;
  }
  | {
    kind: "start game";
    data?: undefined;
  }
  | {
    kind: "roll dices";
    data?: undefined;
  }
  | {
    kind: "select dices";
    data: {
      selected: boolean[]
    }
  }
  | {
    kind: "select field";
    data: {
      fieldId: string
    }
  }
  | {
    kind: "select effect";
    data: {
      fieldId: string
    }
  }
);

export type ClientToServerEvents = {
  send: (data: ClientData) => void
};

export type ServerData = (
  | {
    kind: "set game";
    data: {
      game: GameIO
    }
  }
);

export type ServerToClientEvents = {
  send: (data: ServerData) => void;
};