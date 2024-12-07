import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github'
import { Document } from 'langchain/document'
import { generateEmbedding, summariseCode } from './gemini'
import { db } from '@/server/db'

export const loadGithubRepo = async (githubUrl: string, githubToken?: string) => {
    // langchain
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken || '',
        branch: 'main',
        ignoreFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'],
        recursive: true,
        unknown: 'warn',
        maxConcurrency: 5,
    })

    const docs = await loader.load()
    return docs
}


//console.log(await loadGithubRepo('https://github.com/PHantasm111/RiskFI'));

export const indexGithubRepo = async (projectId: string, githubUrl: string, githubToken?: string) => {
    const docs = await loadGithubRepo(githubUrl, githubToken);
    const allEmbeddings = await generateEmbeddings(docs);

    await Promise.allSettled(allEmbeddings.map(async(embedding, index) => {
        console.log(`processing ${index} of ${allEmbeddings.length}`);

        if (!embedding) return

        console.log("inserting ...");
        
        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
            data: {
                sourceCode : embedding.sourceCode,
                fileName : embedding.fileName,
                summary : embedding.summary,
                projectId,
            }
        })

        await db.$executeRaw`
            UPDATE "SourceCodeEmbedding" 
            SET "summaryEmbedding" = ${embedding.embedding}::vector
            WHERE "id" = ${sourceCodeEmbedding.id}; 
        `

        console.log("inserted !");
        
    }))
}

const generateEmbeddings = async (docs: Document[]) => {
    return await Promise.all(docs.map(async (doc) => {
        const summary = await summariseCode(doc) as string;
        const embedding = await generateEmbedding(summary);
        return {
            summary,
            embedding, 
            sourceCode : JSON.parse(JSON.stringify(doc.pageContent)),
            fileName: doc.metadata.source,
        }
    }))
}