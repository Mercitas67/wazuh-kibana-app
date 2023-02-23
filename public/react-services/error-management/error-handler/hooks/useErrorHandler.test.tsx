import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorHandler } from '../error-handler';
import { useErrorHandler } from './useErrorHandler';
import React from 'react';

jest.mock('../error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn(),
  },
}));
describe.skip('UseErrorHandler', () => {
  it('should return error instance and pass to ErrorHandler when callback fails', async () => {
    const callbackWithError = async () => {
      return Promise.reject(new Error('callback error'));
    };

    let Component = () => {
      const [res, error] = useErrorHandler(callbackWithError);
      return <div>Mocked component</div>;
    };
    const { container } = render(<Component />);

    //await waitFor(() => {
      expect(container).toBeInTheDocument();
      expect(ErrorHandler.handleError).toHaveBeenCalledTimes(1);
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        new Error('callback error'),
      );
    //});

    
  });

  it('should return error instance when callback is resolved', async () => {
    const callbackWithoutError = async () => {
      return Promise.resolve({
        success: true,
      });
    };

    let Component = () => {
      const [res, error] = useErrorHandler(callbackWithoutError);
      return <div>Mocked component</div>;
    };

    const { container } = render(<Component />);

    //await waitFor(() => {
      expect(container).toBeInTheDocument();
      expect(ErrorHandler.handleError).toHaveBeenCalledTimes(0);
    //});
  });
});
