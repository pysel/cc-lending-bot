# CC Lending Vault Bot

A TypeScript bot for automated lending vault operations.

## Features

- 🚀 **TypeScript**: Full TypeScript support with strict type checking
- 🔧 **Configuration**: Environment-based configuration management
- 🔄 **Automated Operations**: Scheduled bot operations with interval-based execution
- 📊 **Monitoring**: Built-in event system for monitoring and logging
- 🛡️ **Error Handling**: Comprehensive error handling and graceful shutdown
- 🧪 **Testing**: Jest testing framework setup
- 📝 **Linting**: ESLint with TypeScript support

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd cc-lending-vault-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure it:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```bash
# Required
API_KEY=your_actual_api_key

# Optional (has defaults)
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
API_URL=https://api.example.com
```

## Usage

### Development

Start the bot in development mode with auto-reload:
```bash
npm run dev
```

Or use watch mode:
```bash
npm run watch
```

### Production

Build and start the bot:
```bash
npm run build
npm start
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start the compiled bot
- `npm run dev` - Start in development mode with ts-node
- `npm run watch` - Start with auto-reload on file changes
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix

## Project Structure

```
src/
├── bot/
│   └── index.ts          # Main Bot class
├── config/
│   └── index.ts          # Configuration management
├── types/
│   └── index.ts          # TypeScript type definitions
└── index.ts              # Application entry point
```

## Configuration

The bot uses environment variables for configuration. See `.env.example` for all available options.

### Required Environment Variables

- `API_KEY`: Your API key for external services

### Optional Environment Variables

- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (error/warn/info/debug)
- `PORT`: Port number for any HTTP server functionality
- `API_URL`: Base URL for API calls

## Customization

### Adding Bot Operations

Modify the `performBotOperations()` method in `src/bot/index.ts` to implement your specific bot logic:

```typescript
private async performBotOperations(): Promise<void> {
  // Add your custom bot logic here
  await this.checkVaultStatus();
  await this.processLendingOpportunities();
  // Add more operations...
}
```

### Adding New Configuration

1. Add the environment variable to `.env.example`
2. Update the `Config` class in `src/config/index.ts`
3. Update the `BotConfig` interface in `src/types/index.ts`

## Error Handling

The bot includes comprehensive error handling:

- Graceful shutdown on SIGINT/SIGTERM
- Uncaught exception handling
- Unhandled promise rejection handling
- Operation-level error handling with logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## License

ISC License 