import type { Subject, Topic, TopicProgress } from "./learning-types";

/** Curated map of major branches, not an exhaustive list of mathematics. */
export const SUBJECTS: Subject[] = [
  {
    "id": "math",
    "title": "Математика",
    "description": "Связная карта от арифметики до анализа, алгебры и топологии. 20 тем с уроками и проверкой; остальные — обзор маршрута."
  },
  {
    "id": "finance",
    "title": "Финансы",
    "description": "От личного бюджета и процентов до оценки бизнеса и портфеля. Карта подготовки: уроки и проверки ещё в разработке."
  },
  {
    "id": "biology",
    "title": "Биология",
    "description": "От клетки до генетики, экологии и биостатистики. Карта подготовки: уроки и проверки ещё в разработке."
  }
];

/** Roadmap nodes have learning outcomes but no completed lesson or assessment. */
export const TOPICS: Topic[] = [
  {
    "id": "math-arithmetic",
    "subjectId": "math",
    "title": "Арифметика и порядок действий",
    "branch": "Основы",
    "level": "foundation",
    "prerequisites": [],
    "outcomes": [
      "Выполнять действия с целыми числами и проверять результат.",
      "Применять скобки и порядок действий."
    ],
    "minutes": 15,
    "assessment": "ready",
    "lesson": {
      "explanation": "Сначала выполняют действия в скобках, затем степени, умножение и деление, затем сложение и вычитание. Действия одной ступени выполняют слева направо. Отрицательное число описывает направление или долг; вычитание отрицательного числа равносильно прибавлению положительного.",
      "example": "Вычислим 18 − 3 × (2 + 1): скобки дают 3, произведение — 9, результат — 9. Проверка: 9 + 9 = 18.",
      "commonMistake": "Считать выражение слева направо без учёта приоритета. В 18 − 3 × 3 нельзя сначала вычесть 3."
    }
  },
  {
    "id": "math-fractions",
    "subjectId": "math",
    "title": "Обыкновенные дроби",
    "branch": "Основы",
    "level": "foundation",
    "prerequisites": [
      "math-arithmetic"
    ],
    "outcomes": [
      "Сокращать дроби и находить общий знаменатель.",
      "Складывать, умножать и делить дроби."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Дробь a/b показывает a долей размера 1/b; знаменатель b не равен нулю. Умножение числителя и знаменателя на одно ненулевое число сохраняет величину дроби. Для сложения доли приводят к общему размеру. При умножении перемножают числители и знаменатели; при делении умножают на обратную дробь.",
      "example": "1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2. А (2/3) ÷ (4/5) = (2/3) × (5/4) = 5/6.",
      "commonMistake": "Складывать знаменатели: 1/3 + 1/6 не равно 2/9. Нельзя делить на нулевую дробь."
    }
  },
  {
    "id": "math-decimals",
    "subjectId": "math",
    "title": "Десятичные числа",
    "branch": "Основы",
    "level": "foundation",
    "prerequisites": [
      "math-fractions"
    ],
    "outcomes": [
      "Переводить конечные десятичные дроби в обычные.",
      "Выполнять действия и осмысленно округлять."
    ],
    "minutes": 15,
    "assessment": "ready",
    "lesson": {
      "explanation": "В десятичной записи каждый следующий разряд в десять раз меньше предыдущего: 0,37 = 37/100. При сложении выравнивают разряды. При округлении смотрят на первый отбрасываемый разряд. В расчётах лучше округлять итог, а не каждый промежуточный шаг.",
      "example": "0,35 + 0,7 = 1,05. Число 2,376 при округлении до сотых становится 2,38, потому что следующая цифра — 6.",
      "commonMistake": "Приравнивать разное число знаков к разному масштабу: 0,7 = 0,70. Раннее округление накапливает ошибку."
    }
  },
  {
    "id": "math-percent",
    "subjectId": "math",
    "title": "Проценты и изменение величины",
    "branch": "Основы",
    "level": "foundation",
    "prerequisites": [
      "math-fractions",
      "math-decimals"
    ],
    "outcomes": [
      "Находить процент от числа и исходную величину.",
      "Различать проценты и процентные пункты."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Один процент — одна сотая. Чтобы найти p% от величины A, вычисляют A × p/100. Рост на p% умножает исходную величину на 1 + p/100; снижение — на 1 − p/100. Процент всегда относится к выбранной базе, поэтому последовательные изменения обычно не компенсируются.",
      "example": "Цена 2000 ₽ после скидки 15% равна 2000 × 0,85 = 1700 ₽. Рост 100 до 120 и снижение на 20% дают 96, а не 100.",
      "commonMistake": "Путать базу процента. Рост доли с 10% до 15% — 5 процентных пунктов и 50% относительно прежней доли."
    }
  },
  {
    "id": "math-ratios",
    "subjectId": "math",
    "title": "Отношения и пропорции",
    "branch": "Основы",
    "level": "foundation",
    "prerequisites": [
      "math-fractions"
    ],
    "outcomes": [
      "Масштабировать величины в заданном отношении.",
      "Решать прямую пропорцию и проверять единицы."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Отношение a:b сравнивает две величины. Пропорция a/b = c/d при ненулевых знаменателях означает ad = bc. При прямой пропорциональности увеличение одной величины в k раз увеличивает вторую в k раз. Прежде чем применять правило, нужно проверить, действительно ли зависимость пропорциональна.",
      "example": "В рецепте вода и крупа относятся как 3:1. Для 200 г крупы нужно 600 г воды. Если 4 одинаковые тетради стоят 120 ₽, то 7 стоят 210 ₽.",
      "commonMistake": "Применять прямую пропорцию к любой связи. Время работы и число одинаково производительных работников при фиксированном объёме связаны обратно."
    }
  },
  {
    "id": "math-powers",
    "subjectId": "math",
    "title": "Степени и корни",
    "branch": "Алгебра",
    "level": "foundation",
    "prerequisites": [
      "math-arithmetic",
      "math-fractions"
    ],
    "outcomes": [
      "Применять правила степеней с допустимыми основаниями.",
      "Находить квадратные корни и учитывать область определения."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Для натурального n степень aⁿ — произведение n одинаковых множителей. При одинаковом основании aᵐ × aⁿ = aᵐ⁺ⁿ. Для a ≠ 0: a⁰ = 1 и a⁻ⁿ = 1/aⁿ. Квадратный корень √a — неотрицательное число, квадрат которого равен a; над вещественными числами a должно быть неотрицательным.",
      "example": "2³ × 2² = 2⁵ = 32. √49 = 7, но уравнение x² = 49 имеет два решения: x = 7 и x = −7.",
      "commonMistake": "Считать (a + b)² равным a² + b². Правильно: a² + 2ab + b². Для вещественного x: √(x²) = |x|."
    }
  },
  {
    "id": "math-linear-equations",
    "subjectId": "math",
    "title": "Линейные уравнения",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-arithmetic",
      "math-fractions"
    ],
    "outcomes": [
      "Решать уравнение ax + b = c.",
      "Проверять найденный корень подстановкой."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Уравнение утверждает равенство двух выражений. Одинаковое допустимое действие с обеими сторонами сохраняет решения. В ax + b = c при a ≠ 0 сначала вычитают b, затем делят на a. Если a = 0, нужно отдельно проверить: равенство либо верно для любого x, либо не имеет решений.",
      "example": "3x + 5 = 20 → 3x = 15 → x = 5. Проверка: 3 × 5 + 5 = 20.",
      "commonMistake": "Менять знак при «переносе» без понимания действия над обеими сторонами или делить на выражение, которое может быть нулём."
    }
  },
  {
    "id": "math-inequalities",
    "subjectId": "math",
    "title": "Неравенства и интервалы",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-linear-equations"
    ],
    "outcomes": [
      "Решать линейные неравенства.",
      "Менять направление знака при умножении на отрицательное число."
    ],
    "minutes": 20,
    "assessment": "ready",
    "lesson": {
      "explanation": "Неравенство задаёт множество допустимых значений. При прибавлении одного числа к обеим сторонам знак сохраняется. При умножении или делении на положительное число он сохраняется; на отрицательное — меняется на противоположный. Строгая граница не включается в ответ, нестрогая включается.",
      "example": "−2x + 3 > 7 → −2x > 4 → x < −2. Число −3 подходит: 9 > 7. Число −2 не подходит: получается равенство.",
      "commonMistake": "Не переворачивать знак при делении на отрицательное число. Проверка одним внутренним значением помогает заметить ошибку."
    }
  },
  {
    "id": "math-quadratics",
    "subjectId": "math",
    "title": "Квадратные уравнения",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-linear-equations",
      "math-powers"
    ],
    "outcomes": [
      "Находить корни квадратного уравнения через дискриминант.",
      "Различать случаи двух, одного и отсутствия вещественных корней."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "В ax² + bx + c = 0 коэффициент a не равен нулю. Дискриминант D = b² − 4ac. При D > 0 есть два вещественных корня (−b ± √D)/(2a); при D = 0 — один двойной корень; при D < 0 вещественных корней нет. Разложение на множители иногда проще формулы.",
      "example": "x² − 5x + 6 = 0: D = 25 − 24 = 1; x = (5 ± 1)/2, поэтому x = 2 или x = 3. Также (x − 2)(x − 3) = 0.",
      "commonMistake": "Терять один корень или считать, что D < 0 означает отсутствие любых корней: комплексные корни изучаются отдельно."
    }
  },
  {
    "id": "math-functions",
    "subjectId": "math",
    "title": "Функции и графики",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-linear-equations"
    ],
    "outcomes": [
      "Определять значение функции и область допустимых аргументов.",
      "Различать аргумент, значение и линейную зависимость."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Функция каждому допустимому аргументу x ставит в соответствие ровно одно значение y. Область определения задаёт, какие x допустимы. Для y = kx + b коэффициент k описывает изменение y при увеличении x на единицу, а b — значение при x = 0. График показывает зависимость, но не заменяет проверку формулы.",
      "example": "Для f(x) = 2x − 3 значение f(4) = 5. Для g(x) = 1/(x − 2) аргумент x = 2 исключён из области определения.",
      "commonMistake": "Путать f(4) с f × 4 или считать, что любая формула определена для всех вещественных x."
    }
  },
  {
    "id": "math-coordinate-geometry",
    "subjectId": "math",
    "title": "Координатная геометрия",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-functions"
    ],
    "outcomes": [
      "Находить расстояние и середину отрезка на плоскости.",
      "Связывать прямую с её уравнением."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Точка плоскости задаётся парой (x, y). Расстояние между A(x₁, y₁) и B(x₂, y₂) равно √((x₂ − x₁)² + (y₂ − y₁)²). Середина отрезка имеет координаты средних арифметических соответствующих координат концов. Прямые можно задавать уравнениями; вертикальная прямая имеет вид x = c.",
      "example": "Для A(1, 2), B(4, 6) расстояние равно √(3² + 4²) = 5, середина — (2,5; 4).",
      "commonMistake": "Складывать изменения координат вместо применения теоремы Пифагора или забывать, что вертикальная прямая не имеет вида y = kx + b."
    }
  },
  {
    "id": "math-plane-geometry",
    "subjectId": "math",
    "title": "Планиметрия: длины и площади",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-arithmetic"
    ],
    "outcomes": [
      "Различать периметр и площадь.",
      "Применять формулы прямоугольника и прямоугольного треугольника."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Периметр измеряет длину границы, площадь — размер поверхности. Для прямоугольника P = 2(a + b), S = ab; для треугольника S = ah/2. В прямоугольном треугольнике квадрат гипотенузы равен сумме квадратов катетов. Длины измеряются в единицах длины, площади — в квадратных единицах.",
      "example": "У прямоугольника 3 × 4 см периметр 14 см и площадь 12 см². Гипотенуза треугольника с катетами 3 и 4 см равна 5 см.",
      "commonMistake": "Подставлять боковую сторону вместо высоты треугольника или указывать площадь в сантиметрах без квадрата."
    }
  },
  {
    "id": "math-trigonometry",
    "subjectId": "math",
    "title": "Тригонометрия: отношения сторон",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-plane-geometry",
      "math-ratios"
    ],
    "outcomes": [
      "Находить синус, косинус и тангенс острого угла.",
      "Различать противолежащий катет, прилежащий катет и гипотенузу."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "В прямоугольном треугольнике для острого угла α: sin α = противолежащий катет / гипотенуза, cos α = прилежащий катет / гипотенуза, tan α = противолежащий / прилежащий. Эти отношения зависят от угла, а не от размера треугольника. Для общего определения углов используют единичную окружность.",
      "example": "Если противолежащий катет равен 3, прилежащий 4, а гипотенуза 5, то sin α = 3/5, cos α = 4/5, tan α = 3/4.",
      "commonMistake": "Выбирать катеты без привязки к выбранному углу или смешивать градусы и радианы в вычислениях."
    }
  },
  {
    "id": "math-sequences",
    "subjectId": "math",
    "title": "Последовательности и прогрессии",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-functions",
      "math-powers"
    ],
    "outcomes": [
      "Находить член арифметической и геометрической прогрессии.",
      "Отличать постоянную разность от постоянного отношения."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Последовательность — функция на натуральных номерах. В арифметической прогрессии соседние члены отличаются на d: aₙ = a₁ + (n − 1)d. В геометрической прогрессии каждый следующий член равен предыдущему, умноженному на q: bₙ = b₁qⁿ⁻¹. Формула должна соответствовать тому, с какого номера начинается отсчёт.",
      "example": "У арифметической прогрессии 3, 7, 11, ... разность 4 и пятый член 19. У геометрической 2, 6, 18, ... отношение 3 и четвёртый член 54.",
      "commonMistake": "Использовать n вместо n − 1 при отсчёте с первого члена. Одинаковые первые два числа ещё не определяют закон всей последовательности."
    }
  },
  {
    "id": "math-combinatorics",
    "subjectId": "math",
    "title": "Комбинаторика: подсчёт вариантов",
    "branch": "Дискретная математика",
    "level": "school",
    "prerequisites": [
      "math-arithmetic"
    ],
    "outcomes": [
      "Применять правило произведения.",
      "Различать упорядоченный выбор и выбор без учёта порядка."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Если первый независимый этап выбора имеет m вариантов, а второй — n, комбинаций mn. Если порядок выбранных разных объектов важен, считают размещения; если не важен — сочетания. Число способов выбрать k объектов из n без повторений равно C(n,k) = n!/(k!(n − k)!). Условия задачи важнее названия формулы.",
      "example": "3 футболки и 2 пары брюк дают 6 комплектов. Двух представителей из 5 человек можно выбрать C(5,2) = 10 способами; председателя и секретаря — 5 × 4 = 20.",
      "commonMistake": "Считать одну пару дважды, когда порядок не важен, или молча разрешать повторения, которых нет в условии."
    }
  },
  {
    "id": "math-probability",
    "subjectId": "math",
    "title": "Вероятность событий",
    "branch": "Вероятность и статистика",
    "level": "school",
    "prerequisites": [
      "math-fractions",
      "math-combinatorics"
    ],
    "outcomes": [
      "Находить вероятность при равновозможных исходах.",
      "Различать независимость и несовместность событий."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Для конечного набора равновозможных исходов вероятность события равна числу подходящих исходов, делённому на общее число. Вероятность лежит между 0 и 1. Вероятности несовместных событий складываются. Вероятности независимых событий перемножаются. Равновозможность и независимость нужно обосновывать условиями задачи.",
      "example": "У честного кубика вероятность чётного числа равна 3/6 = 1/2. Два независимых броска монеты дают вероятность двух орлов (1/2) × (1/2) = 1/4.",
      "commonMistake": "Считать все описанные исходы равновероятными без проверки. Независимые события могут происходить вместе, а несовместные — нет."
    }
  },
  {
    "id": "math-statistics",
    "subjectId": "math",
    "title": "Описательная статистика",
    "branch": "Вероятность и статистика",
    "level": "school",
    "prerequisites": [
      "math-probability",
      "math-decimals"
    ],
    "outcomes": [
      "Находить среднее и медиану небольшого набора данных.",
      "Замечать влияние выбросов и ограничения выборки."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Среднее арифметическое — сумма значений, делённая на их число. Медиана — центральное значение упорядоченного ряда; при чётном числе значений это среднее двух центральных. Среднее чувствительно к выбросам, поэтому полезно смотреть на распределение и объём выборки. Корреляция сама по себе не доказывает причину.",
      "example": "Для 2, 3, 3, 4, 18 среднее равно 6, медиана — 3. Большое последнее значение заметно сдвинуло среднее.",
      "commonMistake": "Искать медиану до сортировки или делать вывод о всей группе по удобной, нерепрезентативной выборке."
    }
  },
  {
    "id": "math-derivatives",
    "subjectId": "math",
    "title": "Производная: скорость изменения",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-functions",
      "math-powers"
    ],
    "outcomes": [
      "Интерпретировать производную как локальную скорость изменения.",
      "Вычислять производную простых степенных функций."
    ],
    "minutes": 30,
    "assessment": "ready",
    "lesson": {
      "explanation": "Производная f′(x) описывает, как быстро меняется значение функции около точки. Она определяется пределом отношения приращения функции к приращению аргумента, если такой предел существует. Для xⁿ с натуральным n: (xⁿ)′ = nxⁿ⁻¹. Производная константы равна нулю; производная суммы равна сумме производных. Здесь изучается прикладной вводный уровень; строгие пределы выделены в отдельную ветвь.",
      "example": "Если f(x) = x³ + 2x, то f′(x) = 3x² + 2; при x = 2 скорость изменения равна 14. Производная не равна самому значению f(2) = 12.",
      "commonMistake": "Считать, что f′(x) = f(x)/x, или путать среднюю скорость на интервале с локальной скоростью в точке."
    }
  },
  {
    "id": "math-integrals",
    "subjectId": "math",
    "title": "Интеграл: накопление величины",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-derivatives"
    ],
    "outcomes": [
      "Находить первообразную простой степенной функции.",
      "Вычислять определённый интеграл и учитывать знак."
    ],
    "minutes": 30,
    "assessment": "ready",
    "lesson": {
      "explanation": "Первообразная F удовлетворяет F′ = f; все первообразные отличаются константой. Определённый интеграл накапливает вклад функции на интервале. Для непрерывной f на [a,b] он равен F(b) − F(a). Для n ≥ 0 первообразная xⁿ равна xⁿ⁺¹/(n + 1) + C. Интеграл с отрицательными участками учитывает их со знаком, поэтому не всегда равен геометрической площади.",
      "example": "Первообразная 2x — x² + C. Интеграл 2x от 0 до 3 равен 3² − 0² = 9. Проверка первообразной: (x² + C)′ = 2x.",
      "commonMistake": "Забывать C в неопределённом интеграле или подставлять пределы в исходную функцию вместо первообразной."
    }
  },
  {
    "id": "math-vectors",
    "subjectId": "math",
    "title": "Векторы и скалярное произведение",
    "branch": "Линейная алгебра",
    "level": "school",
    "prerequisites": [
      "math-coordinate-geometry"
    ],
    "outcomes": [
      "Складывать векторы и находить их длину.",
      "Проверять перпендикулярность через скалярное произведение."
    ],
    "minutes": 25,
    "assessment": "ready",
    "lesson": {
      "explanation": "Вектор задаёт направление и величину. В координатах векторы складывают покомпонентно; умножение на число масштабирует компоненты. Длина (a,b) равна √(a² + b²). Скалярное произведение (a,b)·(c,d) = ac + bd. Два ненулевых вектора перпендикулярны тогда и только тогда, когда их скалярное произведение равно нулю.",
      "example": "Для u = (3,4) длина равна 5. Для v = (4,−3) произведение u·v = 12 − 12 = 0, значит векторы перпендикулярны. Сумма u + v = (7,1).",
      "commonMistake": "Путать длину вектора с суммой координат или считать скалярное произведение новым вектором."
    }
  },
  {
    "id": "math-divisibility",
    "subjectId": "math",
    "title": "Делимость, НОД и НОК",
    "branch": "Теория чисел",
    "level": "school",
    "prerequisites": [
      "math-arithmetic"
    ],
    "outcomes": [
      "Разлагать целые числа на простые множители.",
      "Находить общий делитель и общее кратное."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-real-numbers",
    "subjectId": "math",
    "title": "Рациональные и вещественные числа",
    "branch": "Основы",
    "level": "school",
    "prerequisites": [
      "math-fractions",
      "math-powers"
    ],
    "outcomes": [
      "Различать рациональные и иррациональные числа.",
      "Работать с модулем и числовой прямой."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-algebraic-expressions",
    "subjectId": "math",
    "title": "Алгебраические выражения",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-linear-equations",
      "math-powers"
    ],
    "outcomes": [
      "Раскрывать скобки и выносить общий множитель.",
      "Учитывать ограничения допустимых преобразований."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-systems",
    "subjectId": "math",
    "title": "Системы линейных уравнений",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-linear-equations",
      "math-coordinate-geometry"
    ],
    "outcomes": [
      "Решать системы подстановкой и исключением.",
      "Интерпретировать количество решений геометрически."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-polynomials",
    "subjectId": "math",
    "title": "Многочлены и разложение",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-algebraic-expressions",
      "math-quadratics"
    ],
    "outcomes": [
      "Выполнять операции с многочленами.",
      "Связывать корни с разложением на множители."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-rational-functions",
    "subjectId": "math",
    "title": "Рациональные выражения и функции",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-polynomials",
      "math-functions"
    ],
    "outcomes": [
      "Находить область определения дробной функции.",
      "Учитывать исключённые точки после сокращения."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-exponentials",
    "subjectId": "math",
    "title": "Показательные функции",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-powers",
      "math-functions"
    ],
    "outcomes": [
      "Описывать экспоненциальный рост и убывание.",
      "Решать простые показательные уравнения."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-logarithms",
    "subjectId": "math",
    "title": "Логарифмы",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-exponentials"
    ],
    "outcomes": [
      "Использовать логарифм как обратную показательную функцию.",
      "Применять свойства с проверкой основания и аргумента."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-complex-numbers",
    "subjectId": "math",
    "title": "Комплексные числа",
    "branch": "Алгебра",
    "level": "university",
    "prerequisites": [
      "math-quadratics",
      "math-coordinate-geometry"
    ],
    "outcomes": [
      "Выполнять операции с a + bi.",
      "Переходить между алгебраической и полярной формами."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-proof-logic",
    "subjectId": "math",
    "title": "Логика и математическое доказательство",
    "branch": "Дискретная математика",
    "level": "school",
    "prerequisites": [
      "math-arithmetic"
    ],
    "outcomes": [
      "Различать утверждение, следствие и эквивалентность.",
      "Строить прямое доказательство и контрпример."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-sets",
    "subjectId": "math",
    "title": "Множества и отображения",
    "branch": "Дискретная математика",
    "level": "university",
    "prerequisites": [
      "math-proof-logic"
    ],
    "outcomes": [
      "Работать с объединением, пересечением и дополнением.",
      "Различать инъективные, сюръективные и биективные отображения."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-number-theory",
    "subjectId": "math",
    "title": "Элементарная теория чисел",
    "branch": "Теория чисел",
    "level": "university",
    "prerequisites": [
      "math-divisibility",
      "math-proof-logic"
    ],
    "outcomes": [
      "Применять алгоритм Евклида.",
      "Доказывать свойства целых чисел."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-congruences",
    "subjectId": "math",
    "title": "Сравнения по модулю",
    "branch": "Теория чисел",
    "level": "university",
    "prerequisites": [
      "math-number-theory"
    ],
    "outcomes": [
      "Вычислять остатки и решать простые сравнения.",
      "Понимать, когда допустимо деление по модулю."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-triangles",
    "subjectId": "math",
    "title": "Треугольники и их свойства",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-plane-geometry",
      "math-ratios"
    ],
    "outcomes": [
      "Применять признаки равенства треугольников.",
      "Находить углы и использовать характерные линии."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-circles",
    "subjectId": "math",
    "title": "Окружность и круг",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-plane-geometry"
    ],
    "outcomes": [
      "Связывать центральные и вписанные углы.",
      "Различать длину окружности и площадь круга."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-similarity",
    "subjectId": "math",
    "title": "Подобие и масштаб",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-triangles"
    ],
    "outcomes": [
      "Применять признаки подобия.",
      "Масштабировать длины, площади и объёмы."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "math-solid-geometry",
    "subjectId": "math",
    "title": "Стереометрия",
    "branch": "Геометрия",
    "level": "school",
    "prerequisites": [
      "math-plane-geometry",
      "math-powers"
    ],
    "outcomes": [
      "Описывать прямые и плоскости в пространстве.",
      "Находить площади поверхностей и объёмы простых тел."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-conic-sections",
    "subjectId": "math",
    "title": "Конические сечения",
    "branch": "Геометрия",
    "level": "university",
    "prerequisites": [
      "math-coordinate-geometry",
      "math-quadratics"
    ],
    "outcomes": [
      "Распознавать окружность, эллипс, параболу и гиперболу.",
      "Связывать геометрические свойства с уравнением."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-trig-identities",
    "subjectId": "math",
    "title": "Тригонометрические тождества",
    "branch": "Алгебра",
    "level": "school",
    "prerequisites": [
      "math-trigonometry",
      "math-algebraic-expressions"
    ],
    "outcomes": [
      "Использовать единичную окружность и радианы.",
      "Преобразовывать выражения и решать базовые тригонометрические уравнения."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-limits",
    "subjectId": "math",
    "title": "Пределы: строгие основания",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-functions",
      "math-sequences"
    ],
    "outcomes": [
      "Определять предел последовательности и функции.",
      "Различать вычисление предела и его обоснование."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-continuity",
    "subjectId": "math",
    "title": "Непрерывность",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-limits"
    ],
    "outcomes": [
      "Классифицировать разрывы.",
      "Применять свойства непрерывных функций на отрезке."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-differentiability",
    "subjectId": "math",
    "title": "Дифференцируемость и теоремы анализа",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-derivatives",
      "math-limits"
    ],
    "outcomes": [
      "Различать непрерывность и дифференцируемость.",
      "Использовать теоремы Ролля и о среднем значении."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-derivative-applications",
    "subjectId": "math",
    "title": "Исследование функций и экстремумы",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-derivatives",
      "math-inequalities"
    ],
    "outcomes": [
      "Находить интервалы монотонности и локальные экстремумы.",
      "Проверять границы области при поиске оптимума."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "math-integral-applications",
    "subjectId": "math",
    "title": "Применения интеграла",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-integrals",
      "math-plane-geometry"
    ],
    "outcomes": [
      "Вычислять площади и накопленные величины.",
      "Выбирать границы и учитывать размерность интеграла."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-infinite-series",
    "subjectId": "math",
    "title": "Числовые и степенные ряды",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-sequences",
      "math-limits"
    ],
    "outcomes": [
      "Проверять сходимость ряда.",
      "Использовать разложение функции в степенной ряд в допустимой области."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-multivariable",
    "subjectId": "math",
    "title": "Функции нескольких переменных",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-vectors",
      "math-derivatives"
    ],
    "outcomes": [
      "Работать с поверхностями и линиями уровня.",
      "Различать отдельные направления изменения."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-partial-derivatives",
    "subjectId": "math",
    "title": "Частные производные и градиент",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-multivariable",
      "math-differentiability"
    ],
    "outcomes": [
      "Вычислять частные производные и градиент.",
      "Использовать дифференциал и проверять условия применимости."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-multiple-integrals",
    "subjectId": "math",
    "title": "Кратные интегралы",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-multivariable",
      "math-integrals"
    ],
    "outcomes": [
      "Задавать область интегрирования.",
      "Переходить между порядками интегрирования при допустимых условиях."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-differential-equations",
    "subjectId": "math",
    "title": "Обыкновенные дифференциальные уравнения",
    "branch": "Математический анализ",
    "level": "university",
    "prerequisites": [
      "math-derivatives",
      "math-integrals"
    ],
    "outcomes": [
      "Решать простые уравнения с разделяющимися переменными.",
      "Учитывать начальные условия и проверять решение."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-matrices",
    "subjectId": "math",
    "title": "Матрицы и линейные системы",
    "branch": "Линейная алгебра",
    "level": "university",
    "prerequisites": [
      "math-vectors",
      "math-systems"
    ],
    "outcomes": [
      "Выполнять матричные операции.",
      "Решать линейную систему методом Гаусса."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-determinants",
    "subjectId": "math",
    "title": "Определители и обратная матрица",
    "branch": "Линейная алгебра",
    "level": "university",
    "prerequisites": [
      "math-matrices"
    ],
    "outcomes": [
      "Вычислять определитель небольшой матрицы.",
      "Связывать обратимость с решением системы."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-linear-spaces",
    "subjectId": "math",
    "title": "Линейные пространства и базис",
    "branch": "Линейная алгебра",
    "level": "university",
    "prerequisites": [
      "math-matrices",
      "math-proof-logic"
    ],
    "outcomes": [
      "Проверять линейную независимость.",
      "Находить базис и размерность пространства."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-eigenvalues",
    "subjectId": "math",
    "title": "Собственные значения и преобразования",
    "branch": "Линейная алгебра",
    "level": "university",
    "prerequisites": [
      "math-determinants",
      "math-polynomials",
      "math-linear-spaces"
    ],
    "outcomes": [
      "Находить собственные значения и векторы.",
      "Понимать условия диагонализации."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-distributions",
    "subjectId": "math",
    "title": "Случайные величины и распределения",
    "branch": "Вероятность и статистика",
    "level": "university",
    "prerequisites": [
      "math-probability",
      "math-statistics"
    ],
    "outcomes": [
      "Различать дискретные и непрерывные распределения.",
      "Находить математическое ожидание и дисперсию."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-inference",
    "subjectId": "math",
    "title": "Статистический вывод",
    "branch": "Вероятность и статистика",
    "level": "university",
    "prerequisites": [
      "math-distributions",
      "math-statistics"
    ],
    "outcomes": [
      "Интерпретировать доверительные интервалы и тесты гипотез.",
      "Отличать статистическую значимость от размера эффекта."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-optimization",
    "subjectId": "math",
    "title": "Математическая оптимизация",
    "branch": "Прикладная математика",
    "level": "university",
    "prerequisites": [
      "math-derivative-applications",
      "math-systems"
    ],
    "outcomes": [
      "Задавать целевую функцию и ограничения.",
      "Различать локальный и глобальный оптимум."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-graphs",
    "subjectId": "math",
    "title": "Теория графов",
    "branch": "Дискретная математика",
    "level": "university",
    "prerequisites": [
      "math-combinatorics",
      "math-proof-logic"
    ],
    "outcomes": [
      "Описывать вершины, рёбра, пути и связность.",
      "Решать задачи на деревья и простые сети."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-discrete-algorithms",
    "subjectId": "math",
    "title": "Алгоритмы и дискретные модели",
    "branch": "Дискретная математика",
    "level": "university",
    "prerequisites": [
      "math-graphs",
      "math-proof-logic"
    ],
    "outcomes": [
      "Оценивать корректность и сложность алгоритма.",
      "Применять рекуррентные отношения и динамическое программирование."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-numerical-methods",
    "subjectId": "math",
    "title": "Численные методы и погрешность",
    "branch": "Прикладная математика",
    "level": "university",
    "prerequisites": [
      "math-derivatives",
      "math-matrices"
    ],
    "outcomes": [
      "Приближённо решать уравнения и линейные системы.",
      "Оценивать ошибку, обусловленность и устойчивость."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "math-numerical-integration",
    "subjectId": "math",
    "title": "Численное интегрирование",
    "branch": "Прикладная математика",
    "level": "university",
    "prerequisites": [
      "math-numerical-methods",
      "math-integrals"
    ],
    "outcomes": [
      "Использовать квадратурные формулы.",
      "Проверять результат уменьшением шага и оценкой ошибки."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "math-real-analysis",
    "subjectId": "math",
    "title": "Вещественный анализ",
    "branch": "Математический анализ",
    "level": "advanced",
    "prerequisites": [
      "math-continuity",
      "math-infinite-series",
      "math-proof-logic"
    ],
    "outcomes": [
      "Доказывать утверждения о сходимости и полноте.",
      "Различать поточечную и равномерную сходимость."
    ],
    "minutes": 60,
    "assessment": "roadmap"
  },
  {
    "id": "math-abstract-algebra",
    "subjectId": "math",
    "title": "Абстрактная алгебра",
    "branch": "Алгебра",
    "level": "advanced",
    "prerequisites": [
      "math-complex-numbers",
      "math-sets",
      "math-number-theory"
    ],
    "outcomes": [
      "Работать с группами, кольцами и полями.",
      "Различать подструктуры и гомоморфизмы."
    ],
    "minutes": 60,
    "assessment": "roadmap"
  },
  {
    "id": "math-topology",
    "subjectId": "math",
    "title": "Топология",
    "branch": "Геометрия",
    "level": "advanced",
    "prerequisites": [
      "math-sets",
      "math-continuity"
    ],
    "outcomes": [
      "Определять открытые множества и непрерывные отображения.",
      "Различать компактность, связность и метрическую структуру."
    ],
    "minutes": 60,
    "assessment": "roadmap"
  },
  {
    "id": "math-measure-theory",
    "subjectId": "math",
    "title": "Теория меры и интеграл Лебега",
    "branch": "Математический анализ",
    "level": "advanced",
    "prerequisites": [
      "math-real-analysis",
      "math-sets"
    ],
    "outcomes": [
      "Различать измеримость и интегрируемость.",
      "Применять теоремы о предельном переходе с проверкой условий."
    ],
    "minutes": 60,
    "assessment": "roadmap"
  },
  {
    "id": "math-differential-geometry",
    "subjectId": "math",
    "title": "Дифференциальная геометрия",
    "branch": "Геометрия",
    "level": "advanced",
    "prerequisites": [
      "math-multivariable",
      "math-topology",
      "math-vectors"
    ],
    "outcomes": [
      "Описывать касательные пространства кривых и поверхностей.",
      "Связывать локальные координаты с кривизной."
    ],
    "minutes": 60,
    "assessment": "roadmap"
  },
  {
    "id": "finance-literacy",
    "subjectId": "finance",
    "title": "Личные финансы: базовые понятия",
    "branch": "Личные финансы",
    "level": "foundation",
    "prerequisites": [
      "math-arithmetic",
      "math-percent"
    ],
    "outcomes": [
      "Различать доходы, расходы, активы и обязательства.",
      "Читать стоимость и условия финансового продукта."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "finance-budget",
    "subjectId": "finance",
    "title": "Бюджет и резерв",
    "branch": "Личные финансы",
    "level": "foundation",
    "prerequisites": [
      "finance-literacy",
      "math-arithmetic"
    ],
    "outcomes": [
      "Составлять бюджет с нерегулярными расходами.",
      "Планировать резерв и проверять предположения."
    ],
    "minutes": 25,
    "assessment": "roadmap"
  },
  {
    "id": "finance-interest",
    "subjectId": "finance",
    "title": "Простые и сложные проценты",
    "branch": "Личные финансы",
    "level": "school",
    "prerequisites": [
      "finance-literacy",
      "math-powers"
    ],
    "outcomes": [
      "Сравнивать простое и сложное начисление.",
      "Учитывать периодичность, комиссии и эффективную ставку."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "finance-time-value",
    "subjectId": "finance",
    "title": "Стоимость денег во времени",
    "branch": "Корпоративные финансы",
    "level": "university",
    "prerequisites": [
      "finance-interest",
      "math-sequences"
    ],
    "outcomes": [
      "Дисконтировать денежный поток.",
      "Сравнивать сценарии при выбранной ставке."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "finance-inflation",
    "subjectId": "finance",
    "title": "Инфляция и реальная доходность",
    "branch": "Экономика",
    "level": "school",
    "prerequisites": [
      "finance-time-value",
      "math-percent"
    ],
    "outcomes": [
      "Различать номинальную и реальную доходность.",
      "Учитывать изменение покупательной способности."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "finance-risk",
    "subjectId": "finance",
    "title": "Риск и неопределённость",
    "branch": "Инвестиции",
    "level": "university",
    "prerequisites": [
      "finance-literacy",
      "math-probability",
      "math-statistics"
    ],
    "outcomes": [
      "Различать ожидаемый результат и возможный убыток.",
      "Оценивать ограничения вероятностной модели."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "finance-investments",
    "subjectId": "finance",
    "title": "Инструменты и инвестиционные решения",
    "branch": "Инвестиции",
    "level": "university",
    "prerequisites": [
      "finance-risk",
      "finance-time-value"
    ],
    "outcomes": [
      "Сравнивать свойства финансовых инструментов.",
      "Связывать риск, горизонт и ликвидность."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "finance-accounting",
    "subjectId": "finance",
    "title": "Основы учёта и отчётности",
    "branch": "Корпоративные финансы",
    "level": "school",
    "prerequisites": [
      "finance-budget",
      "math-linear-equations"
    ],
    "outcomes": [
      "Читать баланс и отчёт о результатах.",
      "Различать прибыль и денежный поток."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "finance-valuation",
    "subjectId": "finance",
    "title": "Оценка бизнеса и проектов",
    "branch": "Корпоративные финансы",
    "level": "university",
    "prerequisites": [
      "finance-accounting",
      "finance-time-value"
    ],
    "outcomes": [
      "Рассчитывать сценарную оценку денежных потоков.",
      "Проверять чувствительность результата к допущениям."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "finance-portfolio",
    "subjectId": "finance",
    "title": "Портфель и диверсификация",
    "branch": "Инвестиции",
    "level": "university",
    "prerequisites": [
      "finance-investments",
      "math-vectors",
      "math-statistics"
    ],
    "outcomes": [
      "Описывать веса активов и общий результат портфеля.",
      "Учитывать корреляции и пределы диверсификации."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "biology-cell",
    "subjectId": "biology",
    "title": "Клетка и уровни организации",
    "branch": "Основы биологии",
    "level": "foundation",
    "prerequisites": [],
    "outcomes": [
      "Различать клетку, ткань, орган и организм.",
      "Связывать клеточные структуры с функциями."
    ],
    "minutes": 30,
    "assessment": "roadmap"
  },
  {
    "id": "biology-chemistry",
    "subjectId": "biology",
    "title": "Химические основы жизни",
    "branch": "Основы биологии",
    "level": "school",
    "prerequisites": [
      "biology-cell",
      "math-ratios",
      "math-decimals"
    ],
    "outcomes": [
      "Различать основные классы биологических молекул.",
      "Читать концентрации и пропорции в биологических задачах."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-metabolism",
    "subjectId": "biology",
    "title": "Обмен веществ и энергия",
    "branch": "Биохимия",
    "level": "school",
    "prerequisites": [
      "biology-chemistry"
    ],
    "outcomes": [
      "Связывать ферменты с превращениями веществ.",
      "Различать поток энергии и круговорот веществ."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-genetics",
    "subjectId": "biology",
    "title": "Наследственность и генетика",
    "branch": "Генетика",
    "level": "school",
    "prerequisites": [
      "biology-cell",
      "math-probability"
    ],
    "outcomes": [
      "Связывать ДНК, ген и признак.",
      "Решать базовые вероятностные задачи наследования с явными допущениями."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-physiology",
    "subjectId": "biology",
    "title": "Физиология и гомеостаз",
    "branch": "Физиология",
    "level": "school",
    "prerequisites": [
      "biology-metabolism"
    ],
    "outcomes": [
      "Объяснять согласованную работу систем организма.",
      "Распознавать отрицательную обратную связь."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-evolution",
    "subjectId": "biology",
    "title": "Эволюция и разнообразие",
    "branch": "Эволюционная биология",
    "level": "school",
    "prerequisites": [
      "biology-genetics",
      "math-statistics"
    ],
    "outcomes": [
      "Различать наследственную изменчивость и естественный отбор.",
      "Использовать данные для сравнения эволюционных объяснений."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "biology-ecology",
    "subjectId": "biology",
    "title": "Экология и популяции",
    "branch": "Экология",
    "level": "school",
    "prerequisites": [
      "biology-evolution",
      "math-functions"
    ],
    "outcomes": [
      "Описывать пищевые связи и динамику популяций.",
      "Отличать наблюдение от причинного вывода."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-microbiology",
    "subjectId": "biology",
    "title": "Микроорганизмы и взаимодействия",
    "branch": "Микробиология",
    "level": "school",
    "prerequisites": [
      "biology-cell",
      "biology-chemistry"
    ],
    "outcomes": [
      "Различать бактерии, вирусы и эукариотические микроорганизмы.",
      "Объяснять взаимодействия организма и микробной среды."
    ],
    "minutes": 35,
    "assessment": "roadmap"
  },
  {
    "id": "biology-biostatistics",
    "subjectId": "biology",
    "title": "Биостатистика и дизайн исследования",
    "branch": "Исследовательские методы",
    "level": "university",
    "prerequisites": [
      "biology-genetics",
      "math-statistics"
    ],
    "outcomes": [
      "Планировать сравнение с контрольной группой.",
      "Замечать смещение выборки и смешивающие факторы."
    ],
    "minutes": 40,
    "assessment": "roadmap"
  },
  {
    "id": "biology-systems",
    "subjectId": "biology",
    "title": "Системная биология и модели",
    "branch": "Исследовательские методы",
    "level": "university",
    "prerequisites": [
      "biology-ecology",
      "biology-biostatistics",
      "math-derivatives"
    ],
    "outcomes": [
      "Описывать обратные связи в биологических системах.",
      "Проверять границы применимости математической модели."
    ],
    "minutes": 45,
    "assessment": "roadmap"
  }
];

const topicById = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function getTopic(id: string): Topic | undefined {
  return topicById.get(id);
}

/** Direct prerequisites, including foundations from another subject. */
export function getPrerequisites(topicId: string): Topic[] {
  const topic = getTopic(topicId);
  if (!topic) return [];
  return topic.prerequisites.map((id) => {
    const prerequisite = getTopic(id);
    if (!prerequisite) throw new Error("Unknown prerequisite: " + id);
    return prerequisite;
  });
}

/** Immediate successors, rather than every descendant of a topic. */
export function getNextTopics(topicId: string): Topic[] {
  if (!getTopic(topicId)) return [];
  return TOPICS.filter((topic) => topic.prerequisites.includes(topicId));
}

/**
 * A diagnostic and a transfer task both need to pass before a prerequisite is
 * considered established. A due review does not revoke previous passes.
 * Availability is independent of assessment readiness: roadmap topics still
 * require authored lessons and questions before assessment can start.
 */
export function getAvailability(
  topic: Topic,
  progress: TopicProgress[],
): { unlocked: boolean; missing: Topic[] } {
  const completed = new Map(progress.map((entry) => [entry.topicId, entry]));
  const missing = topic.prerequisites.flatMap((id) => {
    const prerequisite = getTopic(id);
    if (!prerequisite) throw new Error("Unknown prerequisite: " + id);
    const entry = completed.get(id);
    return entry?.diagnosticPassed && entry.transferPassed ? [] : [prerequisite];
  });
  return { unlocked: missing.length === 0, missing };
}
