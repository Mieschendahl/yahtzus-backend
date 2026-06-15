export type ClientData = (
  | {
    kind: "join room",
    data: {
      userId?: string
    }
  }
  | {
    kind: "leave room",
    data?: undefined,
  }
  | {
    kind: "join players",
    data?: undefined
  }
  | {
    kind: "leave players",
    data?: undefined,
  }
  | {
    kind: "start game",
    data?: undefined,
  }
  | {
    kind: "roll dices",
    data?: undefined,
  }
  | {
    kind: "select dices",
    data: {
      selected: boolean[]
    }
  }
  | {
    kind: "select field",
    data: {
      fieldId: FieldId
    }
  }
  | {
    kind: "select effect",
    data: {
      fieldId: FieldId
    }
  }
);

// export type ClientDataCb = (
//   data:
//     | {
//       kind: "response",
//       data: {
//         accepted: boolean,
//         reason?: "invalid user"
//       }
//     }
// ) => void;

export type ClientToServerEvents = {
  send: (data: ClientData) => void
};

export const FIELD_IDS = [
  "ones",
  "twos",
  "threes"
] as const;

export type FieldId = (typeof FIELD_IDS)[number];

export function getFieldIdx(fieldId: string): number {
  return FIELD_IDS.findIndex(fieldId_ => fieldId_ === fieldId);
}

export function getField(fieldId: string, fields: FieldType[]): FieldType | undefined {
  return fields[getFieldIdx(fieldId)];
}

export const EFFECT_IDS = [
  undefined,
  "double",
  "dice",
  "roll"
] as const;

export type EffectId = (typeof EFFECT_IDS)[number];

export function isEffectId(effectId: string): boolean {
  return EFFECT_IDS.some(effectId_ => effectId_ === effectId);
}

export function getEffectId(fieldId: string, effectIds: EffectId[]): EffectId | undefined {
  return effectIds[getFieldIdx(fieldId)];
}

export type EffectState = "locked" | "unlocked" | "in use" | "used";

export type DiceType = {
  value: number,
  selected: boolean,
};

export type FieldType = {
  fieldId: FieldId,
  fieldValue?: number,
  effectState?: EffectState
};

export type PlayerType = {
  userId: string,
  fields: FieldType[]
};

export type StateType = "lobby" | "playing";

export type StaticGameType = {
  userIds: string[],
  effectIds: EffectId[]
};

export type DynamicGameType = {
  state: StateType,
  activeUserId?: string,
  rollCount: number,
  rollMax: number,
  multiplier: number
};

export type ServerData = (
  | {
    kind: "set static game",
    data: {
      game: StaticGameType
    }
  }
  | {
    kind: "set dynamic game",
    data: {
      game: DynamicGameType
    }
  }
  | {
    kind: "set dice",
    data: {
      dice: DiceType[]
    }
  }
  | {
    kind: "set players",
    data: {
      players: PlayerType[]
    }
  }
  | {
    kind: "set field",
    data: {
      userId: string,
      field: FieldType
    }
  }
);

export type ServerToClientEvents = {
  send: (data: ServerData) => void,
};