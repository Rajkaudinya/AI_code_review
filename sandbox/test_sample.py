from sample import Calculator, get_unique_elements, find_target_index


def test_add():
    calc = Calculator()
    assert calc.add(2, 3) == 5


def test_divide_valid():
    calc = Calculator()
    assert calc.divide(10, 2) == 5.0


def test_divide_by_zero():
    calc = Calculator()
    # Calculator.divide does not handle b==0 — this test intentionally fails
    # so the agent can detect and fix the missing ZeroDivisionError guard.
    assert calc.divide(5, 0) is None


def test_unique_elements():
    nums = [1, 2, 3, 4, 5, 3, 2]
    assert get_unique_elements(nums) == [1, 2, 3, 4, 5]


def test_find_target_index():
    items = ["apple", "banana", "cherry"]
    assert find_target_index(items, "banana") == 1
    assert find_target_index(items, "grape") == -1
