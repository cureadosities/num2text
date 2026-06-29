// --- State ---

let enabled = false;
let observer = null;

const originalText = new Map();

// --- Constants ---

const MONTHS = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

const VULGAR_FRACTIONS = {
    "¼": "one quarter",
    "½": "one half",
    "¾": "three quarters",
    "⅐": "one seventh",
    "⅑": "one ninth",
    "⅒": "one tenth",
    "⅓": "one third",
    "⅔": "two thirds",
    "⅕": "one fifth",
    "⅖": "two fifths",
    "⅗": "three fifths",
    "⅘": "four fifths",
    "⅙": "one sixth",
    "⅚": "five sixths",
    "⅛": "one eighth",
    "⅜": "three eighths",
    "⅝": "five eighths",
    "⅞": "seven eighths"
};

// --- Startup ---

// Reads the stored enabled state and activates if needed
chrome.storage.local.get("num2textEnabled", (data) => {
    enabled = Boolean(data.num2textEnabled);

    if (enabled) {
        enableNum2Text();
    }
});

// Listens for toggle messages sent by background.js
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "NUM2TEXT_TOGGLE") return;

    enabled = message.enabled;

    if (enabled) {
        enableNum2Text();
    } else {
        disableNum2Text();
    }
});

// --- Core on/off ---

// Activates extension
function enableNum2Text() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    scanDocument();

    // Watches for new nodes and annotates as they appear
    observer = new MutationObserver((mutations) => {
        if (!enabled) return;

        for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            scanNode(node);
        }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Deactivates extension
function disableNum2Text() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    for (const [node, text] of originalText.entries()) {
        if (node && node.nodeType === Node.TEXT_NODE) {
            node.nodeValue = text;
        }
    }

    originalText.clear();
}

// --- DOM traversal ---

function scanDocument() {
    scanNode(document.body);
}

// Processes a single node
function scanNode(node) {
    if (!node) return;

  // Annotates direct text node immediately.
    if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
        return;
    }

    // Only continues for element nodes 
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Skips the element
    if (shouldSkipElement(node)) return;

    // Rejects blank nodes and whose parent element is on the skip list.
    const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(textNode) {
                if (!textNode.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (textNode.parentElement && shouldSkipElement(textNode.parentElement)) {
                    return NodeFilter.FILTER_REJECT;
                }

            return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    // Collects then processes
    const textNodes = [];

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    for (const textNode of textNodes) {
        processTextNode(textNode);
    }
}

// Returns true for elements whose text content must never be modified
function shouldSkipElement(element) {
    if (!element) return true;

    const tag = element.tagName;

    if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "OPTION" ||
        tag === "SCRIPT" ||
        tag === "STYLE" ||
        tag === "CODE" ||
        tag === "PRE" ||
        tag === "KBD" ||
        tag === "SAMP" ||
        tag === "MATH" ||
        tag === "MN"
    ) {
    return true;
    }

    // Skip any element user can type in
    if (element.isContentEditable) {
        return true;
    }

    return false;
}

// Annotates a single text node
function processTextNode(node) {
    const text = node.nodeValue;

    if (!text || originalText.has(node)) return;

    const annotated = annotateText(text);

    if (annotated !== text) {
        originalText.set(node, text);
        node.nodeValue = annotated;
    }
}

// --- Annotation pipeline ---

// Runs a string through all conversion passes in order and returns fully annotated result
function annotateText(text) {
    const placeholders = [];

    // Replaces a converted value with a unique placeholder token and stores the value
    function hold(value) {
        placeholders.push(value);
        return `__NUM2TEXT_${placeholders.length - 1}__`;
    }

    // Replaces all placeholder tokens in the text with their stored values
    function release(value) {
        return value.replace(/__NUM2TEXT_(\d+)__/g, (_, index) => placeholders[Number(index)]);
    }

    // Skips phone-like numbers
    text = text.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, (match) => {
        const digitCount = match.replace(/\D/g, "").length;
        return digitCount >= 8 ? hold(match) : match;
    });

    // Annotations
    text = convertDates(text, hold);
    text = convertTimes(text, hold);
    text = convertRanges(text, hold);
    text = convertCurrency(text, hold);
    text = convertPercentages(text, hold);
    text = convertScientificNotation(text, hold);
    text = convertFractions(text, hold);
    text = convertOrdinals(text, hold);
    text = convertRomanNumerals(text, hold);
    text = convertPlainNumbers(text, hold);

    return release(text);
}

// --- Converters ---

// Finds dates and replaces the numeric month with its name
function convertDates(text, hold) {
    // Format: YYYY-MM-DD or YYYY/MM/DD
    text = text.replace(/\b(\d{4})([-\/])(0?[1-9]|1[0-2])\2(\d{1,2})\b/g, (match, year, sep, month, day) => {
        const monthName = MONTHS[parseInt(month, 10)];
        return hold(`${year}${sep}${monthName}${sep}${day}`);
    });

    // Format: DD-MM-YYYY or DD/MM/YYYY
    text = text.replace(/\b(\d{1,2})([-\/])(0?[1-9]|1[0-2])\2(\d{4})\b/g, (match, day, sep, month, year) => {
        const monthName = MONTHS[parseInt(month, 10)];
        return hold(`${day}${sep}${monthName}${sep}${year}`);
    });

    return text;
}

// Finds 24h and 12h times and appends a spoken form
function convertTimes(text, hold) {
    return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\s?(am|pm|AM|PM)?\b/g, (match, hour, minute, meridiem) => {
        const h = parseInt(hour, 10);
        const m = parseInt(minute, 10);

        let words = "";

        if (m === 0) {
            words = `${numberToWords(h)} o'clock`;
        } else {
            words = `${numberToWords(h)} ${numberToWords(m)}`;
        }

        if (meridiem) {
            words += ` ${meridiem.toLowerCase()}`;
        }

        return hold(`${match} (${words})`);
    });
}

// Finds numeric ranges separated by a dash or em-dash and appends a spoken form
function convertRanges(text, hold) {
    return text.replace(/\b(-?\d{1,3}(?:,\d{3})*|-?\d+)\s?([–—-])\s?(-?\d{1,3}(?:,\d{3})*|-?\d+)\b/g, (match, a, dash, b) => {
        const na = parseNumber(a);
        const nb = parseNumber(b);

        if (!isAllowedNumber(na) || !isAllowedNumber(nb)) return match;

        return hold(`${match} (${numberToWordsWithSign(na)} to ${numberToWordsWithSign(nb)})`);
    });
}

// Finds currency amounts and appends a spoken form including cents/pence
function convertCurrency(text, hold) {
    return text.replace(/([£$€])\s?(-?\d{1,3}(?:,\d{3})*|-?\d+)(?:\.(\d+))?\b/g, (match, symbol, whole, decimal) => {
        const amount = parseNumber(whole);

        if (!isAllowedNumber(amount)) return match;

        let currencyName = "currency units";
        let subunitName = "subunits";

        if (symbol === "£") {
            currencyName = Math.abs(amount) === 1 ? "pound" : "pounds";
            subunitName = "pence";
        }

        if (symbol === "$") {
            currencyName = Math.abs(amount) === 1 ? "dollar" : "dollars";
            subunitName = "cents";
        }

        if (symbol === "€") {
            currencyName = Math.abs(amount) === 1 ? "euro" : "euros";
            subunitName = "cents";
        }

        let words = `${numberToWordsWithSign(amount)} ${currencyName}`;

        if (decimal !== undefined) {
            const cents = parseInt(decimal.padEnd(2, "0").slice(0, 2), 10);
            if (cents > 0) {
                words += ` and ${numberToWords(cents)} ${subunitName}`;
            }
        }

        return hold(`${match} (${words})`);
    });
}

// Finds percentages and appends a spoken form
function convertPercentages(text, hold) {
    return text.replace(/\b(-?\d{1,3}(?:,\d{3})*|-?\d+)(?:\.(\d+))?%\b/g, (match, whole, decimal) => {
        const value = parseNumber(whole);

        if (!isAllowedNumber(value)) return match;

        let words = decimal
            ? `${numberToWordsWithSign(value)} point ${digitsToWords(decimal)} percent`
            : `${numberToWordsWithSign(value)} percent`;

        return hold(`${match} (${words})`);
    });
}

// Finds numbers in scientific notation and appends a spoken
function convertScientificNotation(text, hold) {
    return text.replace(/\b(-?\d+(?:\.\d+)?)[eE]([+-]?\d+)\b/g, (match, base, exponent) => {
        const baseWords = decimalStringToWords(base);
        const expNum = parseInt(exponent, 10);

        return hold(`${match} (${baseWords} times ten to the power of ${numberToWordsWithSign(expNum)})`);
    });
}

// Finds Unicode vulgar fraction characters  and slash fractions and appends a spoken form
function convertFractions(text, hold) {
    text = text.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (match) => {
        return hold(`${match} (${VULGAR_FRACTIONS[match]})`);
    });

    text = text.replace(/\b(\d+)\/(\d+)\b/g, (match, numerator, denominator) => {
        const n = parseInt(numerator, 10);
        const d = parseInt(denominator, 10);

        if (d === 0) return match;

        // Avoid dates
        if (n > 31 || d > 999) return match;

        return hold(`${match} (${numberToWords(n)} over ${numberToWords(d)})`);
    });

    return text;
}

// Finds ordinal numbers and appends a spoken form
function convertOrdinals(text, hold) {
    return text.replace(/\b(-?\d{1,3}(?:,\d{3})*|-?\d+)(st|nd|rd|th)\b/gi, (match, number, suffix) => {
        const value = parseNumber(number);

        if (!isAllowedNumber(value)) return match;

        return hold(`${match} (${ordinalToWords(value)})`);
    });
}

// Finds Roman numerals of two or more characters and appends their value (single characters are skipped)
function convertRomanNumerals(text, hold) {
    return text.replace(/\b(?=[MDCLXVI]+\b)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\b/g, (match) => {
        if (match.length < 2) return match;

        const value = romanToNumber(match);

        if (!value) return match;

        return hold(`${match} (${numberToWords(value)})`);
    });
}

// Catches any remaining plain integers or decimals
function convertPlainNumbers(text, hold) {
    return text.replace(/\b-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b-?\d+(?:\.\d+)?\b/g, (match, offset, fullText) => {
        const before = fullText[offset - 1] || "";
        const after = fullText[offset + match.length] || "";

        // Avoid annotating inside words/codes as much as possible.
        if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) {
            return match;
        }

        // Avoid already skipped date/time separators.
        if (before === "/" || after === "/" || before === ":" || after === ":") {
            return match;
        }

        const value = parseNumber(match);

        if (!isAllowedNumber(value)) return match;

        return hold(`${match} (${decimalStringToWords(match)})`);
    });
}

// --- Number utilities ---

// Strips commas from a formatted number string and converts it to a JS number
function parseNumber(value) {
    return Number(String(value).replace(/,/g, ""));
}

// Returns true if a number is finite and within the supported range
function isAllowedNumber(value) {
    return Number.isFinite(value) && Math.abs(value) <= 9999999999;
}

// Converts a decimal number string to words
function decimalStringToWords(value) {
    const str = String(value).replace(/,/g, "");

    if (str.includes(".")) {
        const [whole, decimal] = str.split(".");
        return `${numberToWordsWithSign(Number(whole))} point ${digitsToWords(decimal)}`;
    }

    return numberToWordsWithSign(Number(str));
}

// Converts a string of digits to individual spoken words joined by spaces
function digitsToWords(digits) {
    return String(digits)
        .split("")
        .map((digit) => numberToWords(Number(digit)))
        .join(" ");
}

// Wraps numberToWords with sign handling, prepending "minus" for negatives
function numberToWordsWithSign(num) {
    if (num < 0) {
        return `minus ${numberToWords(Math.abs(num))}`;
    }

    return numberToWords(num);
}

// Converts a non-negative integer to its English word form.
// Handles numbers up to the billions by breaking them into groups of three digits
function numberToWords(num) {
    num = Math.floor(Math.abs(num));

    if (num === 0) return "zero";

    const belowTwenty = [
        "",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen"
    ];

    const tens = [
        "",
        "",
        "twenty",
        "thirty",
        "forty",
        "fifty",
        "sixty",
        "seventy",
        "eighty",
        "ninety"
    ];

    // Converts a number from 1–999 to words
    function belowThousand(n) {
        let words = [];

        if (n >= 100) {
            words.push(belowTwenty[Math.floor(n / 100)]);
            words.push("hundred");
            n %= 100;
        }

        if (n >= 20) {
            words.push(tens[Math.floor(n / 10)]);
            n %= 10;
        }

        if (n > 0) {
            words.push(belowTwenty[n]);
        }

        return words.join(" ");
    }

    const parts = [];

    const billions = Math.floor(num / 1000000000);
    const millions = Math.floor((num % 1000000000) / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const rest = num % 1000;

    if (billions) {
        parts.push(`${belowThousand(billions)} billion`);
    }

    if (millions) {
        parts.push(`${belowThousand(millions)} million`);
    }

    if (thousands) {
        parts.push(`${belowThousand(thousands)} thousand`);
    }

    if (rest) {
        parts.push(belowThousand(rest));
    }

    return parts.join(" ");
}

// Takes a cardinal number string and converts its last word to ordinal form
function makeLastWordOrdinal(words) {
    const irregulars = {
        one: "first",
        two: "second",
        three: "third",
        four: "fourth",
        five: "fifth",
        six: "sixth",
        seven: "seventh",
        eight: "eighth",
        nine: "ninth",
        ten: "tenth",
        eleven: "eleventh",
        twelve: "twelfth",
        thirteen: "thirteenth",
        fourteen: "fourteenth",
        fifteen: "fifteenth",
        sixteen: "sixteenth",
        seventeen: "seventeenth",
        eighteen: "eighteenth",
        nineteen: "nineteenth",
        twenty: "twentieth",
        thirty: "thirtieth",
        forty: "fortieth",
        fifty: "fiftieth",
        sixty: "sixtieth",
        seventy: "seventieth",
        eighty: "eightieth",
        ninety: "ninetieth",
        hundred: "hundredth",
        thousand: "thousandth",
        million: "millionth",
        billion: "billionth"
    };

    const parts = words.split(" ");
    const last = parts[parts.length - 1];
    parts[parts.length - 1] = irregulars[last] ?? last + "th";
    return parts.join(" ");
}

// Converts a signed integer to its ordinal word form
function ordinalToWords(num) {
    const sign = num < 0 ? "minus " : "";
    num = Math.abs(num);

    const special = {
        0: "zeroth",
        1: "first",
        2: "second",
        3: "third",
        4: "fourth",
        5: "fifth",
        6: "sixth",
        7: "seventh",
        8: "eighth",
        9: "ninth",
        10: "tenth",
        11: "eleventh",
        12: "twelfth",
        13: "thirteenth",
        14: "fourteenth",
        15: "fifteenth",
        16: "sixteenth",
        17: "seventeenth",
        18: "eighteenth",
        19: "nineteenth"
    };

    if (num < 20) {
        return sign + special[num];
    }

    const tensOrdinal = {
        20: "twentieth",
        30: "thirtieth",
        40: "fortieth",
        50: "fiftieth",
        60: "sixtieth",
        70: "seventieth",
        80: "eightieth",
        90: "ninetieth"
    };

    if (num < 100 && num % 10 === 0) {
        return sign + tensOrdinal[num];
    }

    const lastTwo = num % 100;
    const lastDigit = num % 10;

    // For numbers whose last two digits form a teen (e.g. 111, 1013),
    // speak the prefix as a cardinal and the teen part as an ordinal.
    // FIX: was `lastTwo < 20`, which incorrectly caught lastTwo === 0
    // (e.g. 100, 1000) and appended "zeroth". Guard against that.
    if (lastTwo > 0 && lastTwo < 20) {
        return sign + numberToWords(num - lastTwo) + " " + special[lastTwo];
    }

    // For exact multiples of 10 (e.g. 120, 1000, 100), the ordinal suffix
    // belongs on the last word of the cardinal form.
    // FIX: was `return sign + numberToWords(num)` — returned the cardinal
    // with no ordinal suffix for cases like 120th, 1020th.
    if (lastDigit === 0) {
        return sign + makeLastWordOrdinal(numberToWords(num));
    }

    // For all other numbers (e.g. 123, 1025), speak everything up to the
    // last digit as a cardinal and the last digit as an ordinal.
    return sign + numberToWords(num - lastDigit) + " " + special[lastDigit];
}

// Converts a Roman numeral string to its integer value
function romanToNumber(roman) {
    const values = {
        I: 1,
        V: 5,
        X: 10,
        L: 50,
        C: 100,
        D: 500,
        M: 1000
    };

    let total = 0;
    let previous = 0;

    roman = roman.toUpperCase();

    for (let i = roman.length - 1; i >= 0; i--) {
        const current = values[roman[i]];

        if (!current) return 0;

        if (current < previous) {
            total -= current;
        } else {
            total += current;
        }

        previous = current;
    }

    return total;
}