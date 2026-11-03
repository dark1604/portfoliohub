# Реляційні бази даних та мова запитів SQL: від SELECT до JOIN

У **реляційних базах даних** інформація зберігається у вигляді взаємопов'язаних таблиць (відношень), де кожен рядок (запис) має унікальний ідентифікатор — **первинний ключ (`PRIMARY KEY`)**.

## 1. Ключові поняття реляційної моделі

- **`PRIMARY KEY` (PK)** — поле (або набір полів), що однозначно ідентифікує запис у таблиці (`id`).
- **`FOREIGN KEY` (FK)** — зовнішній ключ, який посилається на `PRIMARY KEY` іншої таблиці, встановлюючи зв'язок (наприклад, `1:N` — «один до багатьох»).

## 2. Порядок виконання операторів у запиті `SELECT`

Важливо розрізняти порядок написання та логічний порядок виконання SQL-запиту рушієм СКБД:

```sql
-- 1. Вибірка топ-учнів з середнім балом вище 10.5
SELECT 
    s.full_name,
    s.grade_level,
    ROUND(AVG(g.score), 2) AS avg_score,
    COUNT(g.id) AS total_grades
FROM students AS s
INNER JOIN grades AS g ON g.student_id = s.id
WHERE s.grade_level BETWEEN 9 AND 11
GROUP BY s.id, s.full_name, s.grade_level
HAVING AVG(g.score) >= 10.5
ORDER BY avg_score DESC
LIMIT 10;
```

## 3. Типи об'єднань таблиць (`JOIN`)

Нехай маємо таблицю учнів $A$ (`students`) та таблицю зданих робіт $B$ (`submissions`):

| Тип JOIN | Математична інтерпретація | Що потрапляє у результат |
| :--- | :--- | :--- |
| `INNER JOIN` | Перетин $A \cap B$ | Лише ті учні, які мають здані роботи |
| `LEFT JOIN` | Уся множина $A$ | Усі учні з $A$; якщо робіт немає — у полях $B$ буде `NULL` |
| `RIGHT JOIN` | Уся множина $B$ | Усі записи з $B$ та відповідні їм записи з $A$ |

## 4. Робота з SQLite у Python

У стандартну бібліотеку Python вбудовано модуль `sqlite3`, який дозволяє працювати з реляційною БД без встановлення окремого сервера:

```python
import sqlite3

with sqlite3.connect(":memory:") as conn:
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            grade INTEGER NOT NULL,
            nmt_score INTEGER
        );
    """)
    cursor.executemany(
        "INSERT INTO students (name, grade, nmt_score) VALUES (?, ?, ?);",
        [("Ірина Бондар", 11, 196), ("Максим Сидоренко", 11, 189), ("Олена Ткач", 10, None)]
    )

    cursor.execute("SELECT name, nmt_score FROM students WHERE grade = 11 ORDER BY nmt_score DESC;")
    for row in cursor.fetchall():
        print(row)
```