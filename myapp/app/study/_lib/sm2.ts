var MIN_EASINESS = 1.3;
var DEFAULT_EASINESS = 2.5;
var DEFAULT_INTERVAL = 0;
var DEFAULT_REPETITIONS = 0;

type Sm2Result = {
  easiness: number;
  interval: number;
  repetitions: number;
  dueDate: string;
};

function sm2Update(
  currentEasiness: number,
  currentInterval: number,
  currentRepetitions: number,
  rating: number
): Sm2Result {
  var easiness = currentEasiness;
  var interval = currentInterval;
  var repetitions = currentRepetitions;

  if (rating === 0) {
    /* Again: reset */
    interval = 1;
    repetitions = 0;
    easiness = easiness - 0.2;
    if (easiness < MIN_EASINESS) {
      easiness = MIN_EASINESS;
    }
  } else if (rating === 1) {
    /* Good */
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions = repetitions + 1;
  } else if (rating === 2) {
    /* Easy */
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions = repetitions + 1;
    easiness = easiness + 0.15;
  }

  var now = new Date();
  var dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return {
    easiness: easiness,
    interval: interval,
    repetitions: repetitions,
    dueDate: dueDate.toISOString()
  };
}

export { sm2Update, DEFAULT_EASINESS, DEFAULT_INTERVAL, DEFAULT_REPETITIONS };
