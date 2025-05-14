---
title: Gatekeepers From The Legacy Age
date: 2025-05-12
tags: [Architecture, Enterprise, Product, Agile, Legacy]
excerpt: Gatekeeping as a means of control in Legacy
---

## Gatekeepers From The Legacy Age

Gatekeeping through manual QA, SRE, and other manual approvals is an anti-pattern that can slow down the entire software delivery process. Here's an in-depth exploration of why it's problematic and its implications. Ideally, QA, SRE, and other manual approval should ensure that only high-quality, production-ready code moves forward in the pipeline. However, when manual approvals become a gatekeeping mechanism, they may be over-relied upon or used to delay progress unnecessarily.

### Key Characteristics of the Anti-Pattern

- **Excessive Reliance on Humans:**  
    Manual QA approvals depend heavily on human intervention, which introduces the risks of delays, inconsistency, and subjective decision-making. This reliance can create bottlenecks, particularly when there are limited resources or if the QA team becomes backlogged.

- **Bottlenecks in the Pipeline:**  
    When a team or organization depends on a single QA process for sign-off, any delays—whether due to staff shortages, miscommunication, or differing priorities—can halt the flow of work. This slows down the continuous integration and deployment process essential to modern agile practices.

- **Lack of Automation and Continuous Feedback:**  
    In a healthy DevOps culture, automation plays a vital role in testing and validating code changes quickly. Relying on manual approvals often means that automated testing frameworks and continuous feedback mechanisms are underutilized. This can lead to slower detection of defects and missed opportunities to streamline the process.

- **Reduced Developer Accountability:**  
    With a gatekeeping QA team in place, developers might rely too heavily on the QA process to catch errors rather than taking responsibility for delivering high-quality code. This dynamic can lead to a culture where quality is seen as someone else’s job, rather than a shared responsibility.

- **Inefficient Use of Quality Assurance Talent:**  
    Instead of enabling QA engineers to innovate and engage in exploratory or higher-value testing, the gatekeeper role forces them into a repetitive approval process. This can lead to burnout and might discourage proactive collaboration focused on continuous improvement in testing methodologies.

### Consequences for Software Delivery

- **Slower Time-to-Market:**  
    Bottlenecks at the manual QA level can delay feature releases, reducing the organization’s ability to respond rapidly to customer feedback or changing market conditions.

- **Reduced Flexibility:**  
    If every code change requires manual scrutiny, adjustments are less agile. This can hurt the organization’s ability to pivot or iterate based on new insights or urgent bug fixes.

- **Higher Risk of Miscommunication:**  
    Manual gatekeeping may involve subjective evaluations or variances in expectations between QA and development teams. This misalignment can lead to disagreements and further delays.

### Alternatives and Solutions

- **Automation of Testing and Deployment Pipelines:**
    Implementing continuous integration, continuous delivery (CI/CD), and automated testing (unit, integration, end-to-end tests) removes the human bottleneck and enables rapid feedback. Automated testing can reliably handle repetitive checks, freeing QA for more complex validation tasks.

- **Shift-Left Testing:**
    Involving QA and testing earlier in the development cycle ensures that quality is embedded from the start. This proactive approach reduces the need for last-minute approvals and rework.

- **Collaborative Quality Assurance:**
    Instead of having a QA gatekeeper, quality becomes a shared responsibility. Developers, QA, and operations can work together to define quality standards and monitor them continuously. Tools like feature flags and canary deployments can help manage risk while maintaining a steady flow in the pipeline.

- **Quality Metrics and Continuous Monitoring:**
    Rather than a manual approval step, defining clear quality metrics and continuously monitoring them using automated dashboards allows a team to trust that quality is upheld. This method provides objective insights and supports a culture of continuous improvement.

In summary, while manual QA approvals are meant to ensure product quality, using them as a gatekeeping mechanism is an anti-pattern because it introduces delays, inconsistencies, and potential misalignments. The modern solution is to adopt automation, shared responsibility, and proactive testing practices to maintain quality without sacrificing agility.
