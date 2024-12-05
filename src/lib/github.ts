import { db } from "@/server/db";
import { Octokit } from "octokit";
import axios from "axios";
import { aiSummariseCommit } from "./gemini";

export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});


type Response = {
    commitMessage: string;
    commitHash: string;
    commitAuthorName: string;
    commitAuthorAvator: string;
    commitDate: string;
}

export const getCommitHashes = async (githubUrl: string): Promise<Response[]> => {

    const [owner, repo] = githubUrl.split('/').slice(-2);
    if (!owner || !repo) {
        throw new Error("Invalid GitHub URL");
    }

    const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo
    })

    const sortedCommits = data.sort(
        (a: any, b: any) =>
            new Date(b.commit.author.date).getTime()
            - new Date(a.commit.author.date).getTime()
    )

    return sortedCommits.slice(0, 10).map((commit: any) => ({
        commitHash: commit.sha as string,
        commitMessage: commit.commit.message ?? "",
        commitAuthorName: commit.commit?.author?.name ?? "",
        commitAuthorAvator: commit.author?.avatar_url ?? "",
        commitDate: commit.commit?.author?.date ?? ""
    }))
}


/**
 * Polls a GitHub repository for new commits and summarizes them.
 *
 * @param projectId - The ID of the project to associate with the commits.
 * @returns An array of processed commits.
 * @throws If the project URL is not found.
 */
export const pollCommit = async (projectId: string) => {
    const { project, githubUrl } = await fetchProjectGithubUrl(projectId)
    const commitHashes = await getCommitHashes(githubUrl);
    const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes)

    const summaryResponses = await Promise.allSettled(unprocessedCommits.map(commit => {
        return summarizeCommits(githubUrl, commit.commitHash)
    }))

    const summaries = summaryResponses.map((response) => {
        if (response.status === "fulfilled") {
            return response.value as string
        }
        return ""
    })

    const commits = await db.commit.createMany({
        data: summaries.map((summary, index) => {
            console.log(`processing commit ${index}`);
            return {
                projectId: projectId,
                commitHash: unprocessedCommits[index]!.commitHash,
                commitMessage: unprocessedCommits[index]!.commitMessage,
                commitAuthorName: unprocessedCommits[index]!.commitAuthorName,
                commitAuthorAvator: unprocessedCommits[index]!.commitAuthorAvator,
                commitDate: unprocessedCommits[index]!.commitDate,
                summary
            }
        })
    })

    return commits
}

/**
 * Fetches the GitHub URL for a specific project by its ID.
 *
 * @param {string} projectId - The ID of the project for which to retrieve the GitHub URL.
 * @returns {Promise<{ project: any, githubUrl: string }>} A promise that resolves to an object containing the project data and its GitHub URL.
 * @throws Will throw an error if the project URL is not found.
 */
async function fetchProjectGithubUrl(projectId: string): Promise<{ project: any; githubUrl: string; }> {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { githubUrl: true }
    })

    if (!project?.githubUrl) {
        throw new Error("Project URL not found")
    }

    return { project, githubUrl: project?.githubUrl }
}


/**
 * Filters out commits that have already been processed for a given project by its ID.
 *
 * @param {string} projectId - The ID of the project for which to filter commits.
 * @param {Response[]} commitHashes - The commits to filter.
 * @returns {Promise<Response[]>} A promise that resolves to an array of unprocessed commits.
 */
async function filterUnprocessedCommits(projectId: string, commitHashes: Response[]): Promise<Response[]> {
    const processedCommits = await db.commit.findMany({
        where: { projectId },
    })

    const unprocessedCommits = commitHashes.filter(
        (commit) => !processedCommits.some(
            (processedCommit) => processedCommit.commitHash === commit.commitHash
        )
    )

    return unprocessedCommits;
}


async function summarizeCommits(githubUrl: string, commitHash: string) {
    // get the diff, then pass the diff into ai
    const { data: diff } = await axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
        headers: {
            Accept: 'application/vnd.github.v3.diff'
        }
    })

    return await aiSummariseCommit(diff) || ""
}