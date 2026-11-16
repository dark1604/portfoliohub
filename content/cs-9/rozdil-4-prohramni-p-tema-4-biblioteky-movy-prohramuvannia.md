# Тема 4. Бібліотеки мови програмування (с. 105–113)

## 1. Стандартні та зовнішні бібліотеки

> 📌 **Бібліотеки** — це спеціальні набори функцій і класів, які можна підключати до своєї програми, щоб розширити її можливості.

- **Стандартні бібліотеки Python** (філософія *«Batteries included»* — «батарейки в комплекті») постачаються разом з інтерпретатором: `math`, `random`, `os`, `sys`, `datetime`, `json`, `csv`, `re`.
- **Зовнішні бібліотеки** створюються спільнотою, зберігаються на **PyPI** (*Python Package Index*) і встановлюються вручну: `NumPy`, `Pandas`, `Matplotlib`, `Requests`, `Django`, `Flask`.

### Способи імпорту
```python
import random                  # імпорт усієї бібліотеки -> random.randint(1, 20)
from math import sqrt          # імпорт окремої функції -> sqrt(25)
import numpy as np             # використання псевдоніма -> np.array([1, 2, 3])
```

---

## 2. Стандартні модулі: `random`, `math`, `datetime`

### Модуль `random` (генератор псевдовипадкових чисел)
Для відтворюваності результатів (наприклад, у тестуванні) задають початкове значення за допомогою `random.seed(10)`.

| Функція | Призначення |
| :--- | :--- |
| `random.randint(a, b)` | Ціле число в діапазоні $[a, b]$ |
| `random.randrange(start, stop, step)` | Число з діапазону з кроком |
| `random.uniform(a, b)` | Випадкове дійсне число між $a$ та $b$ |
| `random.random()` | Випадкове число від $0$ до $1$ |
| `random.choice(seq)` | Випадковий елемент зі списку |
| `random.shuffle(lst)` | Перемішує список |
| `random.sample(seq, k)` | Випадковий піднабір із $k$ елементів |

### Модуль `math`
```python
import math
print(math.pi)                 # 3.141592653589793
print(math.sqrt(81))           # 9.0
print(math.pow(2, 10))         # 1024.0
print(math.factorial(5))       # 120
print(math.gcd(18, 24))        # 6 (найбільший спільний дільник)
print(math.sin(math.pi / 6))   # 0.5
print(math.ceil(3.14))         # 4 (округлення вгору)
print(math.floor(3.99))        # 3 (округлення вниз)
```
Також містить: `math.e`, `math.log(x, base)`, `math.log10(x)`, `math.cos(x)`, `math.radians(deg)`, `math.fabs(x)`.

### Модуль `datetime`
Основні об’єкти: `datetime.date` (дата), `datetime.time` (час), `datetime.datetime` (дата і час), `datetime.timedelta` (інтервал часу).

```python
from datetime import datetime, timedelta
now = datetime.now()
print(now.strftime("%d.%m.%Y %H:%M:%S"))
tomorrow = now + timedelta(days=1)
parsed = datetime.strptime("20.08.2025 12:45", "%d.%m.%Y %H:%M")
```

---

## 3. Менеджер пакетів `pip` і `requirements.txt`

Менеджер пакетів **`pip`** завантажує зовнішні модулі з **PyPI** разом із залежностями. Основні команди в командному рядку (`Win + R → cmd` у Windows або Terminal):
- `pip install requests` — встановлення пакета;
- `pip install --upgrade <пакет>` — оновлення;
- `pip uninstall <пакет>` — видалення;
- `pip list` — перелік встановлених пакетів;
- `pip install -r requirements.txt` — встановлення всіх залежностей проєкту зі списку;
- `--user` — встановлення без прав адміністратора.

---

## 🧠 Запитання для самоперевірки
1. Чим стандартні бібліотеки Python відрізняються від зовнішніх?
2. Наведи три способи імпорту модулів у Python.
3. Для чого використовують функцію `random.seed()`?
4. Яка різниця між `strftime()` та `strptime()` у модулі `datetime`?
5. Для чого потрібен файл `requirements.txt` та команда `pip list`?
