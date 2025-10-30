import { Agent } from '../src/index.js';

/**
 * Example 1: Basic AWS Documentation Search
 * 
 * Ask the agent to search AWS documentation and provide information
 * about AWS services using the MCP server.
 */
async function basicAwsDocSearch() {
    console.log('=== Example 1: Basic AWS Documentation Search ===\n');

    // Create agent with AWS Documentation MCP Server
    const agent = new Agent({
        name: 'aws-docs-assistant',
        modelId: 'eu.amazon.nova-micro-v1:0', // Using Nova Micro with EU inference profile
        description: 'AI assistant with access to AWS documentation',
        mcpServers: [
            {
                name: 'aws-knowledge-mcp-server',
                url: 'https://knowledge-mcp.global.api.aws',
                description: 'AWS Documentation search and access',
                transport: 'streamable-http', // AWS MCP servers use streamable-HTTP
            },
            {
                name: 'microsoft.docs.mcp',
                url: 'https://learn.microsoft.com/api/mcp',
                description: 'Microsoft Azure Documentation reader',
                transport: 'streamable-http', // AWS MCP servers use streamable-HTTP
            },
        ],
        memory: {
            shortTerm: {
                maxMessages: 20,
                maxTokens: 20000, // Increased to handle large tool responses
            },
        },
        modelConfig: {
            temperature: 0.7,
            maxTokens: 2048, // Increased to allow for tool use and response
        },
    });

    console.log('Agent created with AWS Documentation MCP Server');

    // Check MCP server status
    const servers = agent.listMcpServers();
    console.log('Connected MCP Servers:');
    servers.forEach(server => {
        console.log(`- ${server.name}: ${server.status}`);
        console.log(`Tools: ${server.toolCount}`);
        console.log(`Resources: ${server.resourceCount}`);
    });

    // Example conversation: Ask about S3
    console.log('User: "What is Amazon S3 and what are its main features?"');

    try {
        const response = await agent.converse({
            //message: 'What is Amazon S3 and what are its main features? Search the AWS documentation to provide accurate information.',
            message: 'Give me the Azure CLI commands to create an Azure Container App with a managed identity. search Microsoft docs'
        });

        console.log('Assistant:', response.message);

        console.log('Token Usage:');
        console.log(`- Input: ${response.usage.inputTokens}`);
        console.log(`- Output: ${response.usage.outputTokens}`);
        console.log(`- Total: ${response.usage.totalTokens}`);


        if (response.toolCalls && response.toolCalls.length > 0) {
            console.log('Tools Used:');
            response.toolCalls.forEach(call => {
                console.log(`- ${call.name}`);
            });

        }
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Main function to run examples
 */
async function main() {
    // Check for AWS credentials
    if (!process.env.AWS_REGION) {
        console.error('ERROR: AWS_REGION environment variable is not set');
        console.error('Please set your AWS region:');
        console.error('  export AWS_REGION=eu-west-3');
        console.error('');
        process.exit(1);
    }

    // Note: AWS SDK will automatically use credentials from ~/.aws/credentials
    // if AWS_PROFILE or AWS_ACCESS_KEY_ID are not set
    console.log('AWS Configuration:');
    console.log(`- Region: ${process.env.AWS_REGION}`);
    if (process.env.AWS_PROFILE) {
        console.log(`- Profile: ${process.env.AWS_PROFILE}`);
    } else if (process.env.AWS_ACCESS_KEY_ID) {
        console.log('- Using AWS_ACCESS_KEY_ID from environment');
    } else {
        console.log('- Using default AWS credentials from ~/.aws/credentials');
    }

    // Run examples
    await basicAwsDocSearch();
}

// Export examples
export {
    basicAwsDocSearch
};

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
