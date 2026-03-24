CREATE TABLE `agenda_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(200),
	`title` varchar(300) NOT NULL,
	`description` text,
	`address` text,
	`notes` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`allDay` boolean DEFAULT false,
	`status` enum('scheduled','confirmed','done','cancelled') NOT NULL DEFAULT 'scheduled',
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agenda_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(200) NOT NULL,
	`type` enum('prospecting_alfa','prospecting_custom','attendant','full','jarvis') NOT NULL DEFAULT 'full',
	`systemPrompt` text NOT NULL,
	`model` varchar(100) DEFAULT 'gemini-2.5-flash',
	`temperature` decimal(3,2) DEFAULT '0.7',
	`active` boolean NOT NULL DEFAULT true,
	`isDefault` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(8,2) DEFAULT '1',
	`unitPrice` decimal(12,2) NOT NULL,
	`totalPrice` decimal(12,2) NOT NULL,
	`order` int DEFAULT 0,
	CONSTRAINT `budget_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(200) NOT NULL,
	`clientPhone` varchar(30),
	`clientEmail` varchar(320),
	`title` varchar(300) NOT NULL,
	`description` text,
	`status` enum('draft','pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(12,2) NOT NULL,
	`validUntil` timestamp,
	`notes` text,
	`pdfUrl` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(30),
	`email` varchar(320),
	`address` text,
	`city` varchar(100),
	`status` enum('lead','prospect','active','inactive','lost') NOT NULL DEFAULT 'lead',
	`notes` text,
	`source` varchar(100),
	`tags` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(60) NOT NULL,
	`cnpj` varchar(20),
	`address` text,
	`phone` varchar(30),
	`email` varchar(320),
	`website` varchar(255),
	`pix` varchar(120),
	`logoUrl` text,
	`primaryColor` varchar(10) DEFAULT '#059669',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `doc_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(200) NOT NULL,
	`type` enum('proposal','contract','whatsapp','email','other') NOT NULL DEFAULT 'other',
	`content` text NOT NULL,
	`variables` json DEFAULT ('[]'),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `doc_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`type` enum('income','expense','receivable','payable') NOT NULL,
	`category` varchar(100),
	`description` varchar(500) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`dueDate` timestamp,
	`paidAt` timestamp,
	`paid` boolean NOT NULL DEFAULT false,
	`clientId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
