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
  | {
    kind: "restart game",
    data?: undefined
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
  "threes",
  "fours",
  "fives",
  "sixes",
  "three of a kind",
  "four of a kind",
  "full house",
  "small straight",
  "large straight",
  "yahtzee",
  "chance",
] as const;

export type FieldId = (typeof FIELD_IDS)[number];

export function getFieldIdx(fieldId: string): number {
  return FIELD_IDS.findIndex(fieldId_ => fieldId_ === fieldId);
}

export function getField(fieldId: string, fields: FieldType[]): FieldType | undefined {
  return fields[getFieldIdx(fieldId)];
}

export type FieldType = {
  fieldId: FieldId,
  fieldValue?: number,
  effectState?: EffectState
};

export const DERIVED_FIELD_IDS = [
  "upper total",
  "upper bonus",
  "lower total",
  "total",
] as const;

export type DerivedFieldId = (typeof DERIVED_FIELD_IDS)[number];

export type DerivedFieldType = {
  fieldId: DerivedFieldId,
  fieldValue?: number
};

export function getDerivedField(fieldId: string, fields: DerivedFieldType[]): DerivedFieldType | undefined {
  return fields.find(field => field.fieldId === fieldId);
}

export function getFieldValues(
  dice: DiceType[],
  multiplier: number,
): FieldType[] {
  const counts = Array.from({ length: 6 }, () => 0);

  dice.forEach(die => {
    if (die.value >= 1 && die.value <= 6) {
      counts[die.value - 1]++;
    }
  });

  const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);

  const hasNOfAKind = (n: number) => counts.some(count => count >= n);

  const hasFullHouse = counts.some((tripleCount, tripleIndex) =>
    tripleCount >= 3 &&
    counts.some((doubleCount, doubleIndex) =>
      doubleIndex !== tripleIndex && doubleCount >= 2
    )
  );

  const hasSmallStraight =
    [0, 1, 2, 3].every(i => counts[i] > 0) ||
    [1, 2, 3, 4].every(i => counts[i] > 0) ||
    [2, 3, 4, 5].every(i => counts[i] > 0);

  const hasLargeStraight =
    [0, 1, 2, 3, 4].every(i => counts[i] > 0) ||
    [1, 2, 3, 4, 5].every(i => counts[i] > 0);

  return FIELD_IDS.map(fieldId => {
    let fieldValue = 0;

    if (fieldId === "ones") fieldValue = counts[0] * 1;
    else if (fieldId === "twos") fieldValue = counts[1] * 2;
    else if (fieldId === "threes") fieldValue = counts[2] * 3;
    else if (fieldId === "fours") fieldValue = counts[3] * 4;
    else if (fieldId === "fives") fieldValue = counts[4] * 5;
    else if (fieldId === "sixes") fieldValue = counts[5] * 6;
    else if (fieldId === "three of a kind") fieldValue = hasNOfAKind(3) ? diceTotal : 0;
    else if (fieldId === "four of a kind") fieldValue = hasNOfAKind(4) ? diceTotal : 0;
    else if (fieldId === "full house") fieldValue = hasFullHouse ? 25 : 0;
    else if (fieldId === "small straight") fieldValue = hasSmallStraight ? 30 : 0;
    else if (fieldId === "large straight") fieldValue = hasLargeStraight ? 40 : 0;
    else if (fieldId === "yahtzee") fieldValue = hasNOfAKind(5) ? 50 : 0;
    else if (fieldId === "chance") fieldValue = diceTotal;

    return {
      fieldId,
      fieldValue: fieldValue * multiplier,
    };
  });
}

export function getDerivedFieldValues(fields: FieldType[]): DerivedFieldType[] {
  const getFieldValue = (fieldId: FieldId): number => {
    return fields.find(field => field.fieldId === fieldId)?.fieldValue ?? 0;
  };

  const upperTotal =
    getFieldValue("ones") +
    getFieldValue("twos") +
    getFieldValue("threes") +
    getFieldValue("fours") +
    getFieldValue("fives") +
    getFieldValue("sixes");

  const upperBonus = upperTotal >= 63 ? 35 : 0;

  const lowerTotal =
    getFieldValue("three of a kind") +
    getFieldValue("four of a kind") +
    getFieldValue("full house") +
    getFieldValue("small straight") +
    getFieldValue("large straight") +
    getFieldValue("yahtzee") +
    getFieldValue("chance");

  return [
    { fieldId: "upper total", fieldValue: upperTotal },
    { fieldId: "upper bonus", fieldValue: upperBonus },
    { fieldId: "lower total", fieldValue: lowerTotal },
    { fieldId: "total", fieldValue: upperTotal + upperBonus + lowerTotal },
  ];
}

export const EFFECT_IDS = [
  undefined,
  "double",
  "roll",
  "high",
  "low",
  "mid",
  "pair",
  "diff"
] as const;

export type EffectId = (typeof EFFECT_IDS)[number];

export const ROLL_EFFECT_IDS: EffectId[] = [
  "high",
  "low",
  "mid",
  "pair",
  "diff"
] as const;

export function isEffectId(effectId: string): boolean {
  return EFFECT_IDS.some(effectId_ => effectId_ === effectId);
}

export function getEffectId(fieldId: string, effectIds: EffectId[]): EffectId | undefined {
  return effectIds[getFieldIdx(fieldId)];
}

export type EffectState = "locked" | "unlocked" | "used";

export type DiceType = {
  value: number,
  selected: boolean,
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