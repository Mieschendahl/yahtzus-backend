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
    data: undefined
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
    data?: {
      selected: boolean[]
    }
  }
  | {
    kind: "select field";
    data?: {
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
    data: undefined;
  }
);

export type ServerToClientEvents = {
  send: (data: ServerData) => void;
};