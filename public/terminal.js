const GITHUB_USER = "houlianpi";
const GITHUB_API = "https://api.github.com";

const routes = {
	"cd ~": "/",
	"cd home": "/",
	"cd projects": "/projects",
	"cd writing": "/writing",
	"cd about": "/about",
	projects: "/projects",
	writing: "/writing",
	about: "/about",
	home: "/",
};

const meaningfulEventTypes = new Set([
	"PushEvent",
	"PullRequestEvent",
	"IssuesEvent",
	"CreateEvent",
	"ReleaseEvent",
]);

async function fetchGitHub(path) {
	const response = await fetch(`${GITHUB_API}${path}`, {
		headers: { Accept: "application/vnd.github+json" },
	});

	if (!response.ok) {
		if (response.status === 403) {
			throw new Error("GitHub API rate limit reached. Please try again later.");
		}
		throw new Error(`GitHub API request failed (${response.status}).`);
	}

	return response.json();
}

function eventDescription(event) {
	const payload = event.payload || {};

	switch (event.type) {
		case "PullRequestEvent":
			return `${payload.action || "updated"} a pull request`;
		case "PushEvent": {
			const count = Array.isArray(payload.commits) ? payload.commits.length : 0;
			return `pushed ${count || ""} commit${count === 1 ? "" : "s"}`.replace("  ", " ");
		}
		case "IssuesEvent":
			return `${payload.action || "updated"} an issue`;
		case "CreateEvent":
			return `created ${payload.ref_type || "repository"}`;
		case "ReleaseEvent":
			return `${payload.action || "published"} a release`;
		default:
			return event.type.replace("Event", "").toLowerCase();
	}
}

function createActivityLine(event) {
	const line = document.createElement("div");
	line.className = "activity-line";

	const date = document.createElement("time");
	date.dateTime = event.created_at;
	date.textContent = new Date(event.created_at).toLocaleDateString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
	});

	const repo = document.createElement("a");
	repo.href = `https://github.com/${event.repo.name}`;
	repo.target = "_blank";
	repo.rel = "noreferrer";
	repo.textContent = event.repo.name;

	const description = document.createElement("span");
	description.textContent = eventDescription(event);

	line.append(date, repo, description);
	return line;
}

async function getRecentActivity(limit = 8) {
	const events = await fetchGitHub(`/users/${GITHUB_USER}/events/public?per_page=100`);
	return events.filter((event) => meaningfulEventTypes.has(event.type)).slice(0, limit);
}

async function renderLiveActivity() {
	const container = document.querySelector("#live-activity");
	if (!container) return;

	try {
		const events = await getRecentActivity(6);
		container.replaceChildren(...events.map(createActivityLine));
		if (events.length === 0) {
			container.textContent = "no recent public activity";
		}
	} catch (error) {
		container.replaceChildren();
		const message = document.createElement("p");
		message.className = "history-error";
		message.textContent = error instanceof Error ? error.message : "Unable to load GitHub activity.";
		container.append(message);
	}
}

function setupTerminal() {
	const form = document.querySelector("#terminal-form");
	const input = document.querySelector("#terminal-input");
	const output = document.querySelector("#command-output");
	if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !output) return;

	const print = (text, className = "") => {
		const line = document.createElement("div");
		line.className = className;
		line.textContent = text;
		output.append(line);
	};

	const printActivity = async () => {
		print("fetching recent public activity...", "history-muted");
		const events = await getRecentActivity(10);
		events.forEach((event) => {
			const date = new Date(event.created_at).toLocaleDateString("zh-CN");
			print(`${date}  ${event.repo.name}  ${eventDescription(event)}`, "history-live");
		});
	};

	const printRepos = async () => {
		const events = await getRecentActivity(100);
		const repositories = [...new Set(events.map((event) => event.repo.name))].slice(0, 10);
		repositories.forEach((repo) => print(repo, "history-files"));
	};

	const printPullRequests = async () => {
		const result = await fetchGitHub(
			`/search/issues?q=author:${GITHUB_USER}+type:pr&sort=updated&order=desc&per_page=8`,
		);
		result.items.forEach((pullRequest) => {
			const state = pullRequest.pull_request?.merged_at ? "merged" : pullRequest.state;
			print(`#${pullRequest.number} [${state}] ${pullRequest.title}`, "history-live");
		});
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const command = input.value.trim();
		const normalized = command.toLowerCase().replace(/\s+/g, " ");
		const currentPath = form.dataset.currentPath || "~";
		input.value = "";

		if (!command) return;
		print(`➜ ${currentPath} ${command}`, "history-command");

		if (routes[normalized]) {
			window.location.assign(routes[normalized]);
			return;
		}

		try {
			switch (normalized) {
				case "help":
					print("help · ls · pwd · whoami · date · clear");
					print("cd home · cd projects · cd writing · cd about");
					print("gh activity · gh prs · gh repos · open github", "history-live");
					break;
				case "ls":
				case "ls -la":
					print("README.md   about/   projects/   writing/", "history-files");
					break;
				case "pwd":
					print(`/Users/houlianpi${currentPath === "~" ? "" : currentPath.slice(1)}`);
					break;
				case "whoami":
					print("houlianpi — software engineer, open-source contributor, maker");
					break;
				case "date":
					print(new Date().toString());
					break;
				case "clear":
					output.replaceChildren();
					break;
				case "open github":
				case "github":
					window.open("https://github.com/houlianpi", "_blank", "noopener,noreferrer");
					print("Opening github.com/houlianpi...");
					break;
				case "gh activity":
					await printActivity();
					break;
				case "gh repos":
					await printRepos();
					break;
				case "gh prs":
					await printPullRequests();
					break;
				case "cat readme.md":
				case "cat readme":
					print("I build automation tools, contribute to open source, and write down what I learn.");
					break;
				default:
					print(`command not found: ${command}. Type 'help' for available commands.`, "history-error");
			}
		} catch (error) {
			print(error instanceof Error ? error.message : "The dynamic request failed.", "history-error");
		} finally {
			input.focus();
		}
	});

	form.addEventListener("click", () => input.focus());
}

setupTerminal();
renderLiveActivity();
