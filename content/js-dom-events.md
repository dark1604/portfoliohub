# Веб-розробка: DOM-дерево, події та інтерактивні інтерфейси на JavaScript

**DOM (Document Object Model)** — це об'єктне представлення HTML-документа у пам'яті браузера у вигляді ієрархічного дерева вузлів, яким можна керувати за допомогою JavaScript.

## 1. Пошук та маніпуляція елементами

Сучасний стандарт використовує CSS-селектори для доступу до вузлів:

| Метод | Що повертає | Приклад використання |
| :--- | :--- | :--- |
| `document.getElementById(id)` | Один `Element` або `null` | `document.getElementById('searchInput')` |
| `document.querySelector(sel)` | Перший знайдений `Element` | `document.querySelector('.card.active')` |
| `document.querySelectorAll(sel)` | Статичний `NodeList` | `document.querySelectorAll('[data-grade]')` |

### Безпечна зміна вмісту та класів
- Для тексту без HTML-тегів завжди використовуйте `element.textContent = '...'` (захист від XSS-ін'єкцій).
- Для керування CSS-класами використовуйте API `classList`:
  ```javascript
  const panel = document.querySelector('#readerView');
  panel.classList.add('visible');
  panel.classList.remove('hidden');
  panel.classList.toggle('dark-mode');
  ```

## 2. Обробка подій та Делегування (Event Delegation)

Замість того щоб прикріплювати окремий слухач `addEventListener` до кожної зі 100 карток у каталозі, ми прикріплюємо **один слухач** до батьківського контейнера та визначаємо цільовий елемент через `event.target.closest()`:

```javascript
const grid = document.getElementById('articlesGrid');

grid.addEventListener('click', (event) => {
  // Знаходимо найближчу картку, по якій клікнув користувач
  const card = event.target.closest('[data-article-id]');
  if (!card) return;

  const articleId = card.dataset.articleId;
  openArticleReader(articleId);
});
```

## 3. Жива фільтрація масиву даних (Declarative UI)

У сучасних SPA інтерфейс є функцією від стану (`State -> UI`). При зміні пошукового запиту ми фільтруємо масив об'єктів за допомогою методів `filter()` та `map()`:

```javascript
function filterArticles(articles, { subject, grade, query }) {
  const normalizedQuery = query.trim().toLowerCase();

  return articles.filter((item) => {
    const matchSubject = subject === 'ALL' || item.subject === subject;
    const matchGrade = grade === 'ALL' || item.grade === Number(grade);
    const matchQuery =
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.summary.toLowerCase().includes(normalizedQuery);

    return matchSubject && matchGrade && matchQuery;
  });
}
```