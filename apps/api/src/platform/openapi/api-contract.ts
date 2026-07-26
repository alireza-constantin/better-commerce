import {
  type INestApplication,
  RequestMethod,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import {
  DocumentBuilder,
  getSchemaPath,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type { RuntimeEnvironment } from '../config';
import { ProblemDetailsDto, ProblemErrorDto } from './problem-details.dto';

export const API_GLOBAL_PREFIX = 'api';
export const API_VERSION = '1';
export const OPENAPI_UI_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';
export const OPENAPI_SESSION_SCHEME = 'sessionCookie';
export const OPENAPI_CSRF_SCHEME = 'csrfToken';

/**
 * Health probes are infrastructure contracts, not business API contracts. They
 * remain stable and unversioned while application endpoints live under
 * /api/v1.
 */
export function configureApiRouting(app: INestApplication): void {
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
}

export function isOpenApiEnabled(environment: RuntimeEnvironment): boolean {
  return environment !== 'production';
}

export function buildOpenApiConfiguration(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Better Commerce API')
    .setDescription(
      [
        'Same-origin HTTP API for Better Commerce.',
        '',
        'Authentication uses an opaque server-side session. Browsers must send cookies with every request.',
        `Before any state-changing request, call GET /api/v1/auth/csrf and send the returned token in the x-csrf-token header.`,
        'Registration, login, and password changes rotate the session identifier, so obtain a fresh CSRF token afterward.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addCookieAuth(
      '__Host-bc.sid',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Production session cookie. The browser manages this HttpOnly cookie; JavaScript must not read it.',
      },
      OPENAPI_SESSION_SCHEME,
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-csrf-token',
        description:
          'Session-bound token returned by GET /api/v1/auth/csrf. Required for every state-changing request.',
      },
      OPENAPI_CSRF_SCHEME,
    )
    .build();
}

/**
 * Returns the generated document so CI and contract tests can inspect/export
 * the exact schema served by the development documentation endpoint.
 */
export function configureOpenApi(
  app: INestApplication,
  environment: RuntimeEnvironment,
): OpenAPIObject | undefined {
  if (!isOpenApiEnabled(environment)) return undefined;

  const document = SwaggerModule.createDocument(
    app,
    buildOpenApiConfiguration(),
    {
      deepScanRoutes: true,
      extraModels: [ProblemDetailsDto, ProblemErrorDto],
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    },
  );
  hardenOpenApiDocument(document);

  SwaggerModule.setup(OPENAPI_UI_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: 'Better Commerce API',
    swaggerOptions: {
      persistAuthorization: false,
    },
  });

  return document;
}

type MutableResponse = {
  description?: string;
  content?: Record<string, { schema?: { $ref?: string } }>;
  headers?: Record<string, unknown>;
};

type MutableOperation = {
  responses?: Record<string, MutableResponse | { $ref: string }>;
};

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

/**
 * Adds transport guarantees that apply uniformly and are otherwise easy to
 * omit on individual controllers.
 */
export function hardenOpenApiDocument(document: OpenAPIObject): void {
  const problemSchema = { $ref: getSchemaPath(ProblemDetailsDto) };
  const requestIdHeader = {
    description: 'Request correlation identifier.',
    schema: { type: 'string', format: 'uuid' },
  };
  for (const pathItem of Object.values(document.paths)) {
    if (!pathItem) continue;
    for (const [method, candidate] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !candidate) continue;
      const operation = candidate as MutableOperation;
      const responses = (operation.responses ??= {});
      responses.default ??= {
        description:
          'Unexpected error represented as RFC 9457 problem details.',
        content: {
          'application/problem+json': { schema: problemSchema },
        },
      };
      for (const [status, response] of Object.entries(responses)) {
        if ('$ref' in response) continue;
        response.headers ??= {};
        response.headers['x-request-id'] ??= requestIdHeader;
        const statusCode = Number(status);
        if (status === 'default' || statusCode >= 400) {
          response.content ??= {};
          const jsonSchema = response.content['application/json']?.schema?.$ref;
          if (jsonSchema === problemSchema.$ref) {
            delete response.content['application/json'];
          }
          const hasExplicitNonProblemRepresentation = Object.keys(
            response.content,
          ).some((mediaType) => mediaType !== 'application/problem+json');
          if (!hasExplicitNonProblemRepresentation) {
            response.content['application/problem+json'] ??= {
              schema: problemSchema,
            };
          }
        }
      }
    }
  }
}

export { VERSION_NEUTRAL };
