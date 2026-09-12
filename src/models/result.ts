export interface Problem {
    field: string;
    label: string;
    message: string;
}

export class ServiceError {
    readonly code: string;
    readonly name: string;
    readonly description: string;
    readonly problems: Problem[] | null;

    constructor(code: string, name: string, description: string, problems: Problem[] | null = null) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.problems = problems;
    }

    static withProblems(template: ServiceError, problems: Problem[]): ServiceError {
        return new ServiceError(template.code, template.name, template.description, problems);
    }
}

export class Result<T> {
    readonly success: boolean;
    readonly value: T | null;
    readonly error: ServiceError | null;

    private constructor(success: boolean, value: T | null, error: ServiceError | null) {
        this.success = success;
        this.value = value;
        this.error = error;
    }

    static ok<T>(value: T): Result<T> {
        return new Result<T>(true, value, null);
    }

    static fail<T>(error: ServiceError): Result<T> {
        return new Result<T>(false, null, error);
    }

    static async wrap<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
        try {
            return await fn();
        } catch (err) {
            if (err instanceof ServiceError) {
                return Result.fail<T>(err);
            }
            console.error('[Result.wrap] Unhandled error:', err);
            return Result.fail<T>(
                new ServiceError(
                    'OPERATION_FAILED',
                    'Operation Failed',
                    err instanceof Error ? err.message : 'An unexpected error occurred.',
                ),
            );
        }
    }
}
