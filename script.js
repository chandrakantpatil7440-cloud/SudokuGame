const $ = id => document.getElementById(id);
const boardEl = $("board");
const messageEl = $("message");

let puzzle = [], solution = [], grid = [];
let selected = 0, mistakes = 0, seconds = 0;
let history = [], hinted = new Set(), finished = false;
let timer = null;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate a valid completed Sudoku, then remove cells.
function generateSolution() {
  const bands = shuffle([0, 1, 2]);
  const stacks = shuffle([0, 1, 2]);
  const rows = bands.flatMap(b => shuffle([0, 1, 2]).map(r => b * 3 + r));
  const cols = stacks.flatMap(s => shuffle([0, 1, 2]).map(c => s * 3 + c));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.flatMap(r => cols.map(c => {
    const pattern = (r * 3 + Math.floor(r / 3) + c) % 9;
    return nums[pattern];
  }));
}

function show(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = "message " + type;
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.i = i;
    cell.setAttribute("role", "gridcell");
    cell.addEventListener("click", () => {
      selected = i;
      render();
    });
    boardEl.appendChild(cell);
  }
}

function conflicts() {
  const bad = new Set();
  const groups = [];

  for (let r = 0; r < 9; r++)
    groups.push(Array.from({length: 9}, (_, c) => r * 9 + c));

  for (let c = 0; c < 9; c++)
    groups.push(Array.from({length: 9}, (_, r) => r * 9 + c));

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const group = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          group.push((br * 3 + r) * 9 + bc * 3 + c);
      groups.push(group);
    }
  }

  for (const group of groups) {
    const seen = new Map();
    for (const i of group) {
      if (!grid[i]) continue;
      if (!seen.has(grid[i])) seen.set(grid[i], []);
      seen.get(grid[i]).push(i);
    }
    for (const indexes of seen.values()) {
      if (indexes.length > 1) indexes.forEach(i => bad.add(i));
    }
  }
  return bad;
}

function render() {
  const bad = conflicts();
  const number = grid[selected];
  let filled = 0;

  for (let i = 0; i < 81; i++) {
    const cell = boardEl.children[i];
    const r = Math.floor(i / 9), c = i % 9;
    const sr = Math.floor(selected / 9), sc = selected % 9;

    cell.textContent = grid[i] || "";
    cell.className = "cell";
    if (puzzle[i]) cell.classList.add("fixed");
    if (i === selected) cell.classList.add("selected");
    else if (r === sr || c === sc ||
      (Math.floor(r / 3) === Math.floor(sr / 3) &&
       Math.floor(c / 3) === Math.floor(sc / 3))) {
      cell.classList.add("related");
    }
    if (number && grid[i] === number) cell.classList.add("same");
    if (bad.has(i)) cell.classList.add("conflict");
    if (hinted.has(i)) cell.classList.add("hinted");
    cell.disabled = finished;
    cell.setAttribute("aria-selected", String(i === selected));
    if (grid[i]) filled++;
  }

  $("progress").textContent = `${filled} / 81`;
  $("mistakes").textContent = `${mistakes} / 3`;
  $("undo").disabled = !history.length || finished;
  $("erase").disabled = finished || puzzle[selected] !== 0;
  $("hint").disabled = finished;
  $("reset").disabled = finished;
}

function saveHistory() {
  history.push({
    grid: [...grid],
    mistakes,
    hinted: [...hinted]
  });
  if (history.length > 200) history.shift();
}

function enterNumber(n) {
  if (finished) return;
  if (puzzle[selected]) {
    show("Original clues cannot be changed.");
    return;
  }

  saveHistory();
  grid[selected] = n;
  hinted.delete(selected);

  if (n !== solution[selected]) {
    mistakes++;
    show("Not quite right. Check the highlighted conflicts.", "error");
  } else {
    show("Number entered.");
  }

  render();
  checkWin();
}

function erase() {
  if (finished || puzzle[selected] || !grid[selected]) return;
  saveHistory();
  grid[selected] = 0;
  hinted.delete(selected);
  show("Cell cleared.");
  render();
}

function undo() {
  if (finished || !history.length) return;
  const previous = history.pop();
  grid = previous.grid;
  mistakes = previous.mistakes;
  hinted = new Set(previous.hinted);
  show("Last move undone.");
  render();
}

function hint() {
  if (finished) return;
  if (puzzle[selected]) {
    show("Select an empty cell for a hint.");
    return;
  }
  saveHistory();
  grid[selected] = solution[selected];
  hinted.add(selected);
  show("Correct number revealed.", "success");
  render();
  checkWin();
}

function checkWin() {
  if (!grid.every((n, i) => n === solution[i])) return;
  finished = true;
  clearInterval(timer);
  show(`Congratulations! Solved in ${$("timer").textContent}.`, "success");
  render();
}

function reset() {
  if (finished) return;
  grid = [...puzzle];
  mistakes = 0;
  history = [];
  hinted.clear();
  seconds = 0;
  $("timer").textContent = "00:00";
  selected = Math.max(0, puzzle.findIndex(n => n === 0));
  show("Puzzle reset. Good luck!");
  render();
}

function newGame() {
  clearInterval(timer);
  finished = false;
  mistakes = 0;
  seconds = 0;
  history = [];
  hinted.clear();

  solution = generateSolution();
  puzzle = [...solution];

  const blanks = {easy: 35, medium: 45, hard: 52}[$("difficulty").value];
  for (const i of shuffle(Array.from({length: 81}, (_, i) => i)).slice(0, blanks))
    puzzle[i] = 0;

  grid = [...puzzle];
  selected = Math.max(0, puzzle.findIndex(n => n === 0));
  $("timer").textContent = "00:00";
  show("Select a cell, then type a number from 1 to 9.");
  render();

  timer = setInterval(() => {
    if (finished) return;
    seconds++;
    $("timer").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:` +
      `${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);
}

document.querySelectorAll("[data-n]").forEach(button =>
  button.addEventListener("click", () => enterNumber(Number(button.dataset.n)))
);

$("newGame").addEventListener("click", newGame);
$("undo").addEventListener("click", undo);
$("erase").addEventListener("click", erase);
$("hint").addEventListener("click", hint);
$("reset").addEventListener("click", reset);
$("difficulty").addEventListener("change", newGame);

document.addEventListener("keydown", event => {
  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    enterNumber(Number(event.key));
    return;
  }
  if (["Delete", "Backspace", "0"].includes(event.key)) {
    event.preventDefault();
    erase();
    return;
  }

  let r = Math.floor(selected / 9), c = selected % 9;
  if (event.key === "ArrowUp") r = (r + 8) % 9;
  else if (event.key === "ArrowDown") r = (r + 1) % 9;
  else if (event.key === "ArrowLeft") c = (c + 8) % 9;
  else if (event.key === "ArrowRight") c = (c + 1) % 9;
  else return;

  event.preventDefault();
  selected = r * 9 + c;
  render();
});

buildBoard();
newGame();
