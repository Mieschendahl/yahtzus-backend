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
      fieldId: string
    }
  }
  | {
    kind: "select effect",
    data: {
      fieldId: string
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

export type FieldId = "ones" | "twos";

export type EffectId = "double";

export type EffectState = "locked" | "unlocked" | "using" | "used";

export type DiceType = {
  value: number,
  selected: boolean,
};

export type StateType = (
  | {
    kind: "lobby",
    data: {
      playerIds: string[],
      playerIdx?: number,
      rollCount?: number,
      maxRolls?: number
    }
  }
  | {
    kind: "playing"
    data: {
      playerIds: string[],
      playerIdx: number,
      rollCount: number,
      maxRolls: number
    }
  }
);

export type ServerData = (
  | {
    kind: "set state",
    data: StateType
  }
  | {
    kind: "set dice",
    data: {
      dice: DiceType[]
    }
  }
  | {
    kind: "set field",
    data: {
      playerId: string,
      fieldId: FieldId,
      value: number
    }
  }
  | {
    kind:  "set effect",
    data: {
      playerId: string,
      fieldId: FieldId,
      effectId: EffectId,
      state: EffectState
    }
  }
);

export type ServerToClientEvents = {
  send: (data: ServerData) => void,
};