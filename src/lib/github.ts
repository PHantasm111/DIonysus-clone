import { db } from "@/server/db";
import { Octokit } from "octokit";

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
 * Polls the latest commits from a GitHub repository for a given project and filters out
 * the commits that have already been processed.
 *
 * @param {string} projectId - The ID of the project for which to poll commits.
 * @returns {Promise<Response[]>} A promise that resolves to an array of unprocessed commit objects.
 * 
 * This function fetches the GitHub URL associated with the given project ID, retrieves the
 * latest commits from the repository, filters out the commits that have already been processed
 * for the project, and returns the unprocessed commits. It logs the unprocessed commits to the console.
 */
export const pollCommit = async (projectId: string): Promise<Response[]> => {
    const { project, githubUrl } = await fetchProjectGithubUrl(projectId)

    const commitHashes = await getCommitHashes(githubUrl);
    const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes)

    console.log(unprocessedCommits);
    return unprocessedCommits
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

pollCommit('cm49z4w800000eoqvr7ybc39t').then(console.log)

async function summarizeCommits(githubUrl:string, commitHashes:string) {

}