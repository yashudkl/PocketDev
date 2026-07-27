import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { ExplainTerminalDto } from './dto/explain-terminal.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('explain-terminal')
  explainTerminalFailure(@Body() dto: ExplainTerminalDto) {
    return this.assistant.explainTerminalFailure(dto);
  }
}
