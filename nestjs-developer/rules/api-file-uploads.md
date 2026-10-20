---
title: Handle File Uploads with Validated Form-Data DTOs
impact: MEDIUM
impactDescription: Uploads are size- and type-checked at the boundary, alongside the other fields
tags: api, uploads, multipart, nestjs-form-data, validation
---

## Handle File Uploads with Validated Form-Data DTOs

Accept multipart uploads with `nestjs-form-data` so files are validated in the same DTO as the other fields, by the same global `ValidationPipe`. It works on both Fastify and Express.

- Register `NestjsFormDataModule` once (global) with `MemoryStoredFile` storage.
- Put `@FormDataRequest()` on every endpoint that accepts uploads (`POST`, `PUT` or `PATCH`, following the method rules in `api-controller-conventions`).
- Type file fields as `MemoryStoredFile` and validate them with `@IsFile()`, `@MaxFileSize()` and `@HasMimeType()`.
- Multipart sends every non-file field as a string. JSON fields (stored as `jsonb`) need a `@Transform` that parses strings, and must then still be validated. Keep invalid JSON as the raw string so the validator rejects it with a 400 instead of `JSON.parse` throwing a 500.
- Checks that depend on business rules (which file types a user's plan allows) stay in the service.

**Incorrect (unvalidated file, JSON parsing that can crash):**

```typescript
@Patch(':id/profile')
@UseInterceptors(FileInterceptor('avatar'))         // Express-only (multer); file outside the DTO
updateProfile(@UploadedFile() avatar: Express.Multer.File, @Body() dto: UpdateUserProfileDto) {
  // No size or type check: any file of any size reaches the service
  return this.userService.updateProfile(dto, avatar);
}

export class UpdateUserProfileDto {
  @IsOptional()
  @Transform(({ value }) => JSON.parse(value))      // Throws on invalid JSON - a 500, not a 400
  preferences?: Record<string, unknown>;
}
```

**Correct (one validated DTO for fields and files):**

```typescript
// app.module.ts
@Module({
  imports: [NestjsFormDataModule.config({ storage: MemoryStoredFile, isGlobal: true })],
})
export class AppModule {}

// user/dtos/update-user-profile.dto.ts
export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'UI preferences, sent as a JSON string',
    example: { theme: 'dark', language: 'en' },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value; // Rejected by @IsObject below with a 400
    }
  })
  @IsObject()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Profile picture (max 5 MB)', type: 'string', format: 'binary' })
  @IsOptional()
  @IsFile()
  @MaxFileSize(5 * 1024 * 1024)
  @HasMimeType(['image/jpeg', 'image/png', 'image/webp'], { message: 'avatar must be a JPEG, PNG or WebP image' })
  avatar?: MemoryStoredFile;
}

// user/controllers/user.controller.ts
@ApiConsumes('multipart/form-data')
@FormDataRequest()
@Patch(':id/profile') // Partial update: every field is optional
updateProfile(@AuthUser() authUser: JwtUser, @Param() params: UserIdParamDto, @Body() dto: UpdateUserProfileDto) {
  return this.userService.updateProfile(authUser, params.id, dto);
}

// user/services/user.service.ts - file content is on the DTO
if (dto.avatar) {
  await this.fileStorage.put({
    buffer: dto.avatar.buffer,
    filename: dto.avatar.originalName,
    mimeType: dto.avatar.mimetype,
  });
}
```

Reference: [nestjs-form-data](https://github.com/dmitriy-nz/nestjs-form-data)
