export const FIELD_ID = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes"
];

export function isFieldId(value: string): boolean {
  return FIELD_ID.includes(value);
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

export type FieldData = {
  value?: number;
  isPreview: boolean;
};

export type FieldIO = Record<string, FieldData | undefined>;

export type PlayerIO = {
  userId: string;
  fields: FieldIO;
};

export type DiceIO = {
  num: number;
  selected: boolean;
}

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
      fieldname: string
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