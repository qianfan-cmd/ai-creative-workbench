package com.workbench.backendjava.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.AsyncJobConstants;
import com.workbench.backendjava.entity.AsyncJob;
import com.workbench.backendjava.mapper.AsyncJobMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Wave E-B3：消费幂等 — 仅 pending/failed 可 claim 为 running。
 */
@ExtendWith(MockitoExtension.class)
class AsyncJobServiceTest {

    @Mock
    private AsyncJobMapper asyncJobMapper;

    private AsyncJobService asyncJobService;

    @BeforeEach
    void setUp() {
        asyncJobService = new AsyncJobService(asyncJobMapper, new ObjectMapper());
    }

    @Test
    void markRunning_claimsPendingJob() {
        AsyncJob job = jobWithStatus(10L, AsyncJobConstants.STATUS_PENDING);
        when(asyncJobMapper.selectById(10L)).thenReturn(job);

        assertTrue(asyncJobService.markRunning(10L));

        ArgumentCaptor<AsyncJob> captor = ArgumentCaptor.forClass(AsyncJob.class);
        verify(asyncJobMapper).updateById(captor.capture());
        assertTrue(AsyncJobConstants.STATUS_RUNNING.equals(captor.getValue().getStatus()));
    }

    @Test
    void markRunning_claimsFailedJobForRetry() {
        AsyncJob job = jobWithStatus(11L, AsyncJobConstants.STATUS_FAILED);
        when(asyncJobMapper.selectById(11L)).thenReturn(job);

        assertTrue(asyncJobService.markRunning(11L));
        verify(asyncJobMapper).updateById(any(AsyncJob.class));
    }

    @Test
    void markRunning_skipsSucceededJob() {
        AsyncJob job = jobWithStatus(12L, AsyncJobConstants.STATUS_SUCCEEDED);
        when(asyncJobMapper.selectById(12L)).thenReturn(job);

        assertFalse(asyncJobService.markRunning(12L));
        verify(asyncJobMapper, never()).updateById(any(AsyncJob.class));
    }

    @Test
    void markRunning_skipsRunningJob() {
        AsyncJob job = jobWithStatus(13L, AsyncJobConstants.STATUS_RUNNING);
        when(asyncJobMapper.selectById(13L)).thenReturn(job);

        assertFalse(asyncJobService.markRunning(13L));
        verify(asyncJobMapper, never()).updateById(any(AsyncJob.class));
    }

    private static AsyncJob jobWithStatus(Long id, String status) {
        AsyncJob job = new AsyncJob();
        job.setId(id);
        job.setStatus(status);
        return job;
    }
}
