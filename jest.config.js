module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/test/fixtures', '<rootDir>/dist/'],
  coveragePathIgnorePatterns: ['<rootDir>/test/'],
};