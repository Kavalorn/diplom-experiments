# Дипломна робота: Виявлення фейкових відгуків

Цей репозиторій містить код та експерименти для дипломної роботи з виявлення фейкових відгуків на українському медичному ринку.

## Зміст

- [Передумови](#передумови)
- [Встановлення](#встановлення)
- [Збір даних](#збір-даних)
- [Генерація фейкових відгуків](#генерація-фейкових-відгуків)
- [Підготовка датасету](#підготовка-датасету)
- [Запуск експериментів](#запуск-експериментів)
- [Структура проекту](#структура-проекту)

## Передумови

- **Bun** - runtime для виконання TypeScript скриптів
- **Conda** або **Miniconda** - для управління Python середовищами
- **Python 3.11** - для запуску експериментів

## Встановлення

### 1. Встановлення Bun

**Linux/macOS:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Або завантажте з [офіційного сайту](https://bun.sh).

### 2. Встановлення залежностей для скриптів

Перейдіть до директорії `scripts` та встановіть залежності:

```bash
cd scripts
bun install
```

### 3. Встановлення Conda

Якщо у вас ще не встановлено Conda, завантажте [Miniconda](https://docs.conda.io/en/latest/miniconda.html) або [Anaconda](https://www.anaconda.com/products/distribution).

## Збір даних

Файл doctor_reviews.csv не містить записів задля дотримання політик сайту docua та в етичних цілях.

### Скрейпінг відгуків

Для збору реальних відгуків використовується скрипт `scrape-docua-reviews.ts`.

**Важливо:** Перед запуском необхідно налаштувати параметри міста:

1. У шляху URL змініть `{{city}}` на потрібне місто:
   ```
   /ua/doctors/{{city}}/all/page-1?order_by=reviews&sort_asc=false
   ```
   Наприклад: `/ua/doctors/kyiv/all/page-1?order_by=reviews&sort_asc=false`

2. У полі `city` в коді вкажіть назву міста українською.

**Запуск скрипту:**

```bash
cd scripts
bun run src/scrape-docua-reviews.ts
```

Зібрані відгуки будуть збережені в форматі CSV.

## Генерація фейкових відгуків

Ви можете згенерувати синтетичні фейкові відгуки або використати вже готові.

### Опція 1: Використання готових фейкових відгуків

Готові фейкові відгуки знаходяться в файлі:
```
data/fake_reviews.csv
```

### Опція 2: Генерація нових фейкових відгуків

```bash
cd scripts
bun run src/generate-fake-reviews.ts
```

Згенеровані відгуки будуть збережені в `data/fake_reviews.csv`.

## Підготовка датасету

### 1. Створення базового Python середовища

Створіть та активуйте conda середовище з основного файлу `environment.yml`:
(це саме оточення також використовуэться для відтворення експериментыв в папці unsupervised analysis які мають бути відтворені відповідно до свого порядкового номеру в назві)

```bash
# Створення середовища
conda env create -f experiments/environment.yml

# Активація середовища
conda activate xlm-bert
```

### 2. (Опційно) Парафрейзинг для збільшення датасету

Якщо необхідно розмножити фейкові відгуки за допомогою парафрейзингу:

```bash
# Створення окремого середовища для парафрейзингу
cd experiments/paraphrasing
conda env create -f environment.yml
conda activate paraphrasing

# Запуск ноутбука
jupyter notebook paraphrase-reviews-batch.ipynb
```

Виконайте всі комірки ноутбука для генерації парафразованих версій фейкових відгуків.

### 3. Створення збалансованого датасету

Для створення фінального збалансованого датасету з реальних та фейкових відгуків:

```bash
# Якщо ще не активовано основне середовище
conda activate xlm-bert

# Перейдіть до директорії
cd experiments/prepare-dataset

# Запуск ноутбука
jupyter notebook prepare-dataset.ipynb
```

Виконайте всі комірки ноутбука. Буде створено файл зваженого датасету, готового для навчання моделей.

**Примітка:** Якщо не працюватиме - використайте це середовище для цього кроку:
```bash
cd experiments/prepare-dataset
conda env create -f environment.yml
conda activate prepare-dataset
```

## Запуск експериментів

Після підготовки датасету можна запускати експерименти з різними моделями.

**Важливо:** Експерименти можна запускати у довільному порядку, **окрім ensemble**.

### Доступні експерименти:

1. **TF-IDF** - базовий підхід на основі TF-IDF векторизації
   ```bash
   cd experiments/tf-idf
   jupyter notebook
   ```

2. **mBERT** - багатомовна модель BERT
   ```bash
   cd experiments/mbert
   jupyter notebook
   ```

3. **UkrRoBERTa** - модель RoBERTa для української мови
   ```bash
   cd experiments/ukr-roberta
   jupyter notebook
   ```

4. **XLM-BERT** - крос-лінгвальна модель BERT
   ```bash
   cd experiments/xlm-bert
   jupyter notebook
   ```

### Ensemble модель

**Важливо:** Для запуску ensemble експерименту спочатку необхідно **повністю навчити** наступні моделі:
- mBERT (`experiments/mbert`)
- UkrRoBERTa (`experiments/ukr-roberta`)
- XLM-BERT (`experiments/xlm-bert`)

Після того, як всі три моделі навчені та збережені:

```bash
cd experiments/ensemble
jupyter notebook
```

Ensemble модель об'єднає передбачення всіх трьох моделей для покращення загальної точності.

## Структура проекту

```
.
├── scripts/                        # TypeScript скрипти для збору даних
│   ├── src/
│   │   ├── scrape-docua-reviews.ts  # Скрейпінг відгуків
│   │   └── generate-fake-reviews.ts # Генерація фейкових відгуків
│   ├── package.json
│   └── tsconfig.json
│
├── data/                           # Дані
│   ├── fake_reviews.csv            # Фейкові відгуки
│   ├── final_dataset.csv           # Фінальний збалансований датасет
│   ├── results_mbert/              # Результати mBERT
│   ├── results_ukrbert/            # Результати UkrRoBERTa
│   └── xml-bert-results/           # Результати XLM-BERT
│
├── experiments/                    # Експерименти
│   ├── environment.yml             # Основне Python середовище
│   │
│   ├── paraphrasing/               # Парафрейзинг відгуків
│   │   ├── environment.yml
│   │   └── paraphrase-reviews-batch.ipynb
│   │
│   ├── prepare-dataset/            # Підготовка датасету
│   │   ├── environment.yml
│   │   └── prepare-dataset.ipynb
│   │
│   ├── tf-idf/                     # TF-IDF експеримент
│   ├── mbert/                      # mBERT експеримент
│   ├── ukr-roberta/                # UkrRoBERTa експеримент
│   ├── xlm-bert/                   # XLM-BERT експеримент
│   ├── ensemble/                   # Ensemble модель (запускати останньою)
│   ├── unsupervised-analysis/      # unsupervised експерименти
│ 
│
└── README.md                       # Цей файл
```

## Послідовність виконання

Рекомендована послідовність дій для повного відтворення експериментів:

1. Встановити Bun та залежності
2. Скрейпити відгуки з doc.ua (або використати існуючі дані)
3. Згенерувати фейкові відгуки (або використати існуючі)
4. Створити conda середовище з `experiments/environment.yml`
5. (Опційно) Виконати парафрейзинг для збільшення датасету
6. Підготувати збалансований датасет за допомогою `prepare-dataset.ipynb`
7. Запустити експерименти з моделями у довільному порядку:
   - TF-IDF
   - mBERT
   - UkrRoBERTa
   - XLM-BERT
8. **Останнім** запустити ensemble експеримент
9. Проаналізувати результати
10. Також для unsuoervised експериментів - виконати ноутбуки в папці unsupervised-analysis відповідно до порядкового номеру ноутбуку. (Всі попередні кроки окрім створення датасету (2,3,5,6) не э обов'язковими)


---
