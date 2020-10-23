#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MocksqsStack } from '../lib/mocksqs-stack';

const app = new cdk.App();
new MocksqsStack(app, 'MocksqsStack');
