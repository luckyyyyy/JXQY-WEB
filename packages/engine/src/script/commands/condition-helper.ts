/**
 * Shared condition evaluator for script commands.
 */
export function evaluateCondition(
  condition: string,
  getVariable: (name: string) => number
): boolean {
  const match = condition.match(/\$([_a-zA-Z0-9]+)\s*([><=]+)\s*([-]?\d+|\$[_a-zA-Z0-9]+)/);
  if (!match) {
    if (condition.startsWith("$")) {
      const varName = condition.slice(1).trim();
      return getVariable(varName) !== 0;
    }
    return false;
  }

  const [, varName, operator, rightValue] = match;
  const leftVal = getVariable(varName);
  const rightVal = rightValue.startsWith("$")
    ? getVariable(rightValue.slice(1))
    : Number.parseInt(rightValue, 10);

  switch (operator) {
    case "==":
      return leftVal === rightVal;
    case "!=":
    case "<>":
      return leftVal !== rightVal;
    case ">=":
      return leftVal >= rightVal;
    case "<=":
      return leftVal <= rightVal;
    case ">":
    case ">>":
      return leftVal > rightVal;
    case "<":
    case "<<":
      return leftVal < rightVal;
    default:
      return false;
  }
}
