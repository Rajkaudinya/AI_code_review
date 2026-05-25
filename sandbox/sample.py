import os
import sys
import math

class Calculator:
    def __init__(self):
        self.history = []

    def add(self, a, b):
        result = a + b
        self.history.append(f"Added {a} + {b} = {result}")
        return result

    def divide(self, a, b):
        return a / b

def get_unique_elements(nums):
    unique = []
    for x in nums:
        if x not in unique:
            unique.append(x)
    return unique

def find_target_index(items, target):
    for i, item in enumerate(items):
        if item == target:
            return i
    return -1
